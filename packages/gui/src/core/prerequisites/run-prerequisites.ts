import type { PrereqReport } from '../../shared/types/prerequisites';
import type { ProcessEvent, ProcessRunner, RunHandle, RunSpec } from '../process/runner-types';

export interface RunPrereqDeps {
  runner: ProcessRunner;
  /** The command to run, already built from the manifest (engine: buildCommandSpec). */
  spec: RunSpec;
  /** Turns the buffered output into a report — selected from the manifest's parser key. */
  parse: (raw: string, exitCode: number | null) => PrereqReport;
}

export interface PrereqRun {
  /** The spec being run, exposed for assertions/diagnostics. */
  spec: RunSpec;
  /** Sync run thunk for a Task: spawns the process, forwards events, buffers output. */
  run: (onEvent: (event: ProcessEvent) => void) => RunHandle;
  /** Resolves with the parsed report once the process exits. */
  result: Promise<PrereqReport>;
}

/**
 * Prepare a prerequisite check. The product-specific parts — which script to run and
 * how to parse it — arrive via `spec` and `parse` (both derived from the manifest by
 * the caller), so this stays a generic "run a process, buffer its output, parse on
 * exit" flow. Fully testable with a fake ProcessRunner replaying a fixture transcript.
 */
export function createPrereqRun(deps: RunPrereqDeps): PrereqRun {
  let resolveResult!: (report: PrereqReport) => void;
  const result = new Promise<PrereqReport>((resolve) => {
    resolveResult = resolve;
  });

  const run = (onEvent: (event: ProcessEvent) => void): RunHandle => {
    let buffer = '';
    const handle = deps.runner.run(deps.spec, (event) => {
      if (event.type === 'stdout' || event.type === 'stderr') buffer += event.chunk;
      onEvent(event);
    });
    void handle.done.then((res) => {
      resolveResult(deps.parse(buffer, res.code));
    });
    return handle;
  };

  return { spec: deps.spec, run, result };
}
