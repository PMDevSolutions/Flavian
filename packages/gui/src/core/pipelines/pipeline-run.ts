import { join } from 'node:path';
import type { PipelineInput, PipelineResult } from '../../shared/types/pipeline';
import type { ProcessEvent, ProcessRunner, RunHandle, RunSpec } from '../process/runner-types';
import type { CommandBuilder } from '../shell/command-builder';
import { createInitRun } from '../init/run-init';

/** The instruction handed to a headless Claude Code session for a Figma conversion. */
export function figmaPrompt(figmaUrl: string, slug: string): string {
  return (
    `Convert the Figma design at ${figmaUrl} into a WordPress FSE block theme using ` +
    `the figma-to-fse-autonomous-workflow. Use the theme slug "${slug}" and write the ` +
    `theme to themes/${slug}. Work autonomously through to a validated theme.`
  );
}

/** Build the spec for the Figma pipeline: a headless `claude -p` session. */
export async function figmaSpec(
  commands: CommandBuilder,
  repoRoot: string,
  input: PipelineInput,
): Promise<RunSpec> {
  if (!input.figmaUrl?.trim()) throw new Error('A Figma file URL is required.');
  return commands.claude(['-p', figmaPrompt(input.figmaUrl.trim(), input.slug)], repoRoot);
}

/** Build the spec for the InDesign pipeline: the deterministic `flavian pipeline indesign` CLI. */
export function indesignSpec(
  commands: CommandBuilder,
  repoRoot: string,
  input: PipelineInput,
): RunSpec {
  if (!input.indesignFile?.trim()) throw new Error('An .idml or .pdf file is required.');
  return commands.nodeBin(
    join(repoRoot, 'bin', 'flavian.mjs'),
    ['pipeline', 'indesign', input.indesignFile.trim(), '--slug', input.slug],
    repoRoot,
  );
}

export interface PipelineDeps {
  repoRoot: string;
  input: PipelineInput;
  runner: ProcessRunner;
  commands: CommandBuilder;
}

export interface PipelineRun {
  run: (onEvent: (event: ProcessEvent) => void) => RunHandle;
  result: Promise<PipelineResult>;
}

/**
 * Prepare a conversion run. Figma spawns a headless Claude session; InDesign runs
 * the deterministic CLI; Canva reuses the init wizard's canva path (createInitRun)
 * so there's a single Canva code path. Validation errors throw before any task.
 */
export async function createPipelineRun(deps: PipelineDeps): Promise<PipelineRun> {
  const { kind, slug } = deps.input;

  if (kind === 'canva') {
    if (!deps.input.canvaExport?.trim()) throw new Error('A Canva export directory is required.');
    const init = await createInitRun({
      repoRoot: deps.repoRoot,
      input: {
        name: slug,
        title: '',
        theme: 'canva',
        canvaExport: deps.input.canvaExport.trim(),
        woo: false,
        multisite: false,
        multisiteMode: 'subdirectory',
        port: 8080,
        email: '',
        git: false,
      },
    });
    return {
      run: init.run,
      result: init.result.then((r) => ({ ok: r.ok, kind, slug: r.projectName, error: r.error })),
    };
  }

  const spec =
    kind === 'figma'
      ? await figmaSpec(deps.commands, deps.repoRoot, deps.input)
      : indesignSpec(deps.commands, deps.repoRoot, deps.input);

  let resolveResult!: (result: PipelineResult) => void;
  const result = new Promise<PipelineResult>((resolve) => {
    resolveResult = resolve;
  });

  const run = (onEvent: (event: ProcessEvent) => void): RunHandle => {
    const handle = deps.runner.run(spec, onEvent);
    void handle.done.then((res) => {
      resolveResult({
        ok: res.code === 0,
        kind,
        slug,
        error: res.code === 0 ? undefined : 'Conversion failed — see the log for details.',
      });
    });
    return handle;
  };

  return { run, result };
}
