import { join } from 'node:path';
import type { DockerCommand } from '../../shared/types/docker';
import type { RunSpec } from '../process/runner-types';
import type { CommandBuilder } from '../shell/command-builder';

const COMMANDS: readonly DockerCommand[] = [
  'build',
  'start',
  'stop',
  'restart',
  'install',
  'logs',
  'list-themes',
  'activate-theme',
];

export function isDockerCommand(value: string): value is DockerCommand {
  return (COMMANDS as readonly string[]).includes(value);
}

/** Build a RunSpec for `bash wordpress-local.sh <command> [arg]`. */
export function dockerCommandSpec(
  commands: CommandBuilder,
  repoRoot: string,
  command: DockerCommand,
  arg?: string,
): Promise<RunSpec> {
  const script = join(repoRoot, 'wordpress-local.sh');
  const args = arg ? [command, arg] : [command];
  return commands.bashScript(script, args, repoRoot);
}
