import type { QaScript } from '../../shared/types/qa';
import type { RunSpec } from '../process/runner-types';
import type { CommandBuilder } from '../shell/command-builder';

/** QA scripts run through bash so their pnpm pipelines (and shell redirection) work as written. */
const SCRIPTS: Record<QaScript, string> = {
  'visual:diff': 'pnpm run visual:diff',
  'lighthouse:run': 'pnpm run lighthouse:run',
};

export function isQaScript(value: string): value is QaScript {
  return Object.prototype.hasOwnProperty.call(SCRIPTS, value);
}

export function qaCommandSpec(
  commands: CommandBuilder,
  repoRoot: string,
  script: QaScript,
): Promise<RunSpec> {
  return commands.bashCommand(SCRIPTS[script], repoRoot);
}
