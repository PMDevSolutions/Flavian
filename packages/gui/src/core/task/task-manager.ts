import type { TaskKind, TaskSnapshot } from '../../shared/types/task';
import type { ProcessEvent, ProcessResult, RunHandle } from '../process/runner-types';
import { Task } from './task';

export interface CreateTaskInput {
  kind: TaskKind;
  run: (onEvent: (event: ProcessEvent) => void) => RunHandle;
  isSuccess?: (result: ProcessResult) => boolean;
}

/** How long a terminal task's snapshot stays queryable before cleanup. */
const TERMINAL_RETENTION_MS = 60_000;

/**
 * Registry of live tasks. Main holds one instance and exposes it to IPC so every
 * streamed operation (this sub-issue: prereq check; later: docker, conversions,
 * QA) flows through the same create/subscribe/cancel surface.
 */
export class TaskManager {
  private readonly tasks = new Map<string, Task>();
  private counter = 0;
  private readonly now: () => number;

  constructor(opts: { now?: () => number } = {}) {
    this.now = opts.now ?? Date.now;
  }

  create(input: CreateTaskInput): Task {
    const id = `${input.kind}-${++this.counter}`;
    const task = new Task({
      id,
      kind: input.kind,
      run: input.run,
      isSuccess: input.isSuccess,
      now: this.now,
    });
    this.tasks.set(id, task);
    task.subscribe((event) => {
      if (
        event.kind === 'state' &&
        (event.state === 'succeeded' || event.state === 'failed' || event.state === 'cancelled')
      ) {
        const timer = setTimeout(() => this.tasks.delete(id), TERMINAL_RETENTION_MS);
        timer.unref?.();
      }
    });
    return task;
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  snapshot(id: string): TaskSnapshot | null {
    return this.tasks.get(id)?.snapshot() ?? null;
  }

  list(): TaskSnapshot[] {
    return [...this.tasks.values()].map((t) => t.snapshot());
  }

  cancel(id: string, signal?: NodeJS.Signals): void {
    this.tasks.get(id)?.cancel(signal);
  }
}
