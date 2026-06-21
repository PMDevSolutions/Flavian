import { join } from 'node:path';
import type { PrereqReport } from '../../shared/types/prerequisites';
import type { ProcessEvent, ProcessRunner, RunHandle, RunSpec } from '../process/runner-types';
import type { CommandBuilder } from '../shell/command-builder';
import { parsePrereqOutput } from './prereq-parser';

export interface RunPrereqDeps {
  runner: ProcessRunner;
  commands: CommandBuilder;
  /** Absolute path to the repo's scripts/ directory. */
  scriptsDir: string;
  /** Repo root, used as the working directory for the script. */
  repoRoot: string;
}

export interface PrereqRun {
  /** The resolved spec (bash + script path), exposed for assertions/diagnostics. */
  spec: RunSpec;
  /** Sync run thunk for a Task: spawns the process, forwards events, buffers output. */
  run: (onEvent: (event: ProcessEvent) => void) => RunHandle;
  /** Resolves with the parsed report once the process exits. */
  result: Promise<PrereqReport>;
}

/**
 * Prepares a prerequisite check. Resolves the bash command up front (async), then
 * returns a synchronous `run` thunk suitable for TaskManager.create — keeping the
 * Task abstraction unaware of shell resolution. Fully testable with a fake
 * ProcessRunner replaying a fixture transcript and a fake ShellResolver.
 */
export async function createPrereqRun(deps: RunPrereqDeps): Promise<PrereqRun> {
  const scriptPath = join(deps.scriptsDir, 'check-prerequisites.sh');
  const spec = await deps.commands.bashScript(scriptPath, [], deps.repoRoot);

  let resolveResult!: (report: PrereqReport) => void;
  const result = new Promise<PrereqReport>((resolve) => {
    resolveResult = resolve;
  });

  const run = (onEvent: (event: ProcessEvent) => void): RunHandle => {
    let buffer = '';
    const handle = deps.runner.run(spec, (event) => {
      if (event.type === 'stdout' || event.type === 'stderr') buffer += event.chunk;
      onEvent(event);
    });
    void handle.done.then((res) => {
      resolveResult(parsePrereqOutput(buffer, res.code));
    });
    return handle;
  };

  return { spec, run, result };
}
