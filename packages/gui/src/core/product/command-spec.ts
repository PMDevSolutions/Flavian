import { join } from 'node:path';
import type { CommandDescriptor } from '../../shared/product/manifest';
import type { RunSpec } from '../process/runner-types';
import type { CommandBuilder } from '../shell/command-builder';

/** Variables substituted into a command's `{name}` placeholders at run time. */
export type CommandVars = Readonly<Record<string, string>>;

/** Fill `{name}` placeholders in a template's parts from `vars` (missing → ''). */
export function fillTemplate(template: readonly string[] | undefined, vars: CommandVars): string[] {
  return (template ?? []).map((part) =>
    part.replace(/\{(\w+)\}/g, (_match, key: string) => vars[key] ?? ''),
  );
}

/**
 * Interpret a manifest CommandDescriptor into a concrete RunSpec via the generic
 * CommandBuilder. This is the single place a step's declared command becomes a
 * process — there is no per-product branch. Script/module paths are resolved against
 * the active project root; `argsTemplate` placeholders are filled from `vars`.
 *
 * `module`/`delegate` descriptors are NOT runnable here — they have dedicated engine
 * flows (the init wizard's in-process apply(); Canva delegating to the wizard).
 */
export async function buildCommandSpec(
  commands: CommandBuilder,
  repoRoot: string,
  descriptor: CommandDescriptor,
  vars: CommandVars = {},
): Promise<RunSpec> {
  switch (descriptor.exec) {
    case 'bashScript':
      return commands.bashScript(
        join(repoRoot, descriptor.script),
        fillTemplate(descriptor.argsTemplate, vars),
        repoRoot,
      );
    case 'bashCommand':
      return commands.bashCommand(descriptor.command, repoRoot);
    case 'nodeBin':
      return commands.nodeBin(
        join(repoRoot, descriptor.script),
        fillTemplate(descriptor.argsTemplate, vars),
        repoRoot,
      );
    case 'claude':
      return commands.claude(fillTemplate(descriptor.argsTemplate, vars), repoRoot);
    case 'module':
    case 'delegate':
      throw new Error(
        `buildCommandSpec cannot run an '${descriptor.exec}' command — it has a dedicated engine flow.`,
      );
  }
}
