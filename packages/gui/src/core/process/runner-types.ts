/**
 * The process-execution contract. A ProcessRunner spawns a command, streams its
 * output as incremental events, reports its terminal result, and is cancellable.
 * Two implementations satisfy it: ChildProcessRunner (default) and PtyRunner (stub).
 */

export type ProcessEvent =
  | { type: 'stdout'; chunk: string }
  | { type: 'stderr'; chunk: string }
  | { type: 'spawn'; pid: number }
  | { type: 'error'; message: string } // spawn failure (e.g. ENOENT: bash/docker missing)
  | { type: 'exit'; code: number | null; signal: NodeJS.Signals | null };

export interface RunSpec {
  /** Absolute path or PATH-resolvable executable. Never a shell string. */
  command: string;
  args: readonly string[];
  cwd: string;
  /** Extra env vars merged over process.env. */
  env?: Record<string, string>;
  /** Emit stdout/stderr split on newline boundaries (with a final flush on exit). */
  lineBuffered?: boolean;
}

export interface ProcessResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export interface RunHandle {
  readonly pid: number | undefined;
  /** Resolves once the process terminates (exit or unrecoverable spawn error). */
  readonly done: Promise<ProcessResult>;
  /** Request termination; SIGTERM by default, escalated to SIGKILL after a grace period. */
  cancel(signal?: NodeJS.Signals): void;
}

export interface ProcessRunner {
  run(spec: RunSpec, onEvent: (event: ProcessEvent) => void): RunHandle;
}
