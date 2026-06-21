import type { ProcessEvent, ProcessResult, RunHandle } from './runner-types';

export type AsyncEmit = (line: string) => void;

/**
 * Adapt a logged in-process async operation into a Task `run` thunk, so things
 * that aren't subprocesses (e.g. importing and calling the init wizard's apply()
 * directly) flow through the same Task/stream/IPC plumbing as spawned commands.
 *
 * The operation receives an `emit(line)` callback (wired to a logger); resolving
 * maps to exit code 0, throwing to exit code 1 (with the message as stderr + an
 * error event). Cancellation is best-effort: in-process work generally can't be
 * interrupted safely, so cancel() is a no-op here.
 */
export function makeAsyncRun(
  fn: (emit: AsyncEmit) => Promise<void>,
): (onEvent: (event: ProcessEvent) => void) => RunHandle {
  return (onEvent) => {
    let settle!: (result: ProcessResult) => void;
    const done = new Promise<ProcessResult>((resolve) => {
      settle = resolve;
    });
    const emit: AsyncEmit = (line) =>
      onEvent({ type: 'stdout', chunk: line.endsWith('\n') ? line : `${line}\n` });

    // Defer so the caller can wire up subscribers before output starts.
    queueMicrotask(() => {
      fn(emit).then(
        () => {
          onEvent({ type: 'exit', code: 0, signal: null });
          settle({ code: 0, signal: null });
        },
        (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          onEvent({ type: 'stderr', chunk: `${message}\n` });
          onEvent({ type: 'error', message });
          onEvent({ type: 'exit', code: 1, signal: null });
          settle({ code: 1, signal: null });
        },
      );
    });

    return { pid: undefined, done, cancel: () => {} };
  };
}
