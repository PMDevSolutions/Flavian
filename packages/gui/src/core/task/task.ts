import type { TaskEvent, TaskKind, TaskSnapshot, TaskState } from '../../shared/types/task';
import type { ProcessEvent, ProcessResult, RunHandle } from '../process/runner-types';
import { Emitter } from './emitter';

export interface TaskOptions {
  id: string;
  kind: TaskKind;
  /** Starts the underlying process, forwarding ProcessEvents; returns the handle. */
  run: (onEvent: (event: ProcessEvent) => void) => RunHandle;
  /**
   * Decides succeeded vs failed from the terminal result. Default: `code === 0`.
   * The prereq task overrides this (exit 0 AND 1 are both task-success — "missing
   * requirements" is a valid result, not a task failure; only exit 2 = failure).
   */
  isSuccess?: (result: ProcessResult) => boolean;
  /** Max log lines retained for late subscribers (ring buffer). Default 1000. */
  logLimit?: number;
  /** Injectable clock for tests. Default Date.now. */
  now?: () => number;
}

/**
 * A long-running, streamed operation. Wraps a RunHandle, runs the state machine
 * (pending → running → succeeded|failed|cancelled), keeps a bounded log buffer,
 * and emits TaskEvents. Pure core — no Electron.
 */
export class Task {
  readonly id: string;
  readonly kind: TaskKind;

  private _state: TaskState = 'pending';
  private _exitCode: number | null = null;
  private _startedAt: number | null = null;
  private _endedAt: number | null = null;

  private readonly log: string[] = [];
  private readonly logLimit: number;
  private readonly events = new Emitter<TaskEvent>();
  private readonly now: () => number;
  private handle: RunHandle | null = null;

  constructor(private readonly opts: TaskOptions) {
    this.id = opts.id;
    this.kind = opts.kind;
    this.logLimit = opts.logLimit ?? 1000;
    this.now = opts.now ?? Date.now;
  }

  get state(): TaskState {
    return this._state;
  }

  /** Begin running (guarded: starts at most once). */
  start(): RunHandle {
    if (this.handle) return this.handle;
    this._state = 'running';
    this._startedAt = this.now();
    this.emitState();

    this.handle = this.opts.run((event) => this.onProcessEvent(event));

    void this.handle.done.then((result) => {
      this._exitCode = result.code;
      this._endedAt = this.now();
      if (this._state === 'cancelled') {
        this.emitState();
        return;
      }
      const ok = (this.opts.isSuccess ?? ((r) => r.code === 0))(result);
      this._state = ok ? 'succeeded' : 'failed';
      this.emitState();
    });

    return this.handle;
  }

  cancel(signal?: NodeJS.Signals): void {
    if (this.isTerminal()) return;
    this._state = 'cancelled';
    this._endedAt = this.now();
    this.handle?.cancel(signal);
    this.emitState();
  }

  subscribe(fn: (event: TaskEvent) => void): () => void {
    return this.events.on(fn);
  }

  snapshot(): TaskSnapshot {
    return {
      id: this.id,
      kind: this.kind,
      state: this._state,
      exitCode: this._exitCode,
      startedAt: this._startedAt,
      endedAt: this._endedAt,
      logTail: [...this.log],
    };
  }

  private onProcessEvent(event: ProcessEvent): void {
    if (event.type === 'stdout' || event.type === 'stderr') {
      const text = event.chunk.replace(/\r\n/g, '\n');
      for (const line of text.split('\n')) {
        if (line === '') continue;
        this.pushLog(line);
        this.events.emit({ kind: 'log', stream: event.type, line });
      }
    } else if (event.type === 'error') {
      const line = `[error] ${event.message}`;
      this.pushLog(line);
      this.events.emit({ kind: 'log', stream: 'stderr', line });
    }
    // 'spawn' / 'exit' are internal; terminal state is emitted from the done handler.
  }

  private pushLog(line: string): void {
    this.log.push(line);
    if (this.log.length > this.logLimit) {
      this.log.splice(0, this.log.length - this.logLimit);
    }
  }

  private emitState(): void {
    this.events.emit({ kind: 'state', state: this._state, exitCode: this._exitCode });
  }

  private isTerminal(): boolean {
    return this._state === 'succeeded' || this._state === 'failed' || this._state === 'cancelled';
  }
}
