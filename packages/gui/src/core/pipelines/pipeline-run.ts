import type { CommandDescriptor } from '../../shared/product/manifest';
import type { PipelineInput, PipelineResult } from '../../shared/types/pipeline';
import type { ProcessEvent, ProcessRunner, RunHandle } from '../process/runner-types';
import type { CommandBuilder } from '../shell/command-builder';
import { buildCommandSpec } from '../product/command-spec';
import { createInitRun } from '../init/run-init';

export interface PipelineDeps {
  repoRoot: string;
  input: PipelineInput;
  runner: ProcessRunner;
  commands: CommandBuilder;
  /** The pipeline step's command descriptor, from the manifest. */
  command: CommandDescriptor;
  /** Repo-relative init module dir, for the Canva ⇒ wizard delegate path. */
  initModuleDir: string;
}

export interface PipelineRun {
  run: (onEvent: (event: ProcessEvent) => void) => RunHandle;
  result: Promise<PipelineResult>;
}

/**
 * Prepare a conversion run from a manifest-declared command descriptor:
 *   - `claude`  (Figma)    → a headless `claude -p "<prompt>"` session;
 *   - `nodeBin` (InDesign) → the deterministic `node bin/flavian.mjs pipeline indesign …`;
 *   - `delegate` (Canva)   → the wizard's Canva path (createInitRun), so there is one
 *     Canva code path.
 * Required-input validation runs first and throws before any task is created.
 */
export async function createPipelineRun(deps: PipelineDeps): Promise<PipelineRun> {
  const { kind, slug } = deps.input;

  if (deps.command.exec === 'delegate') {
    if (!deps.input.canvaExport?.trim()) throw new Error('A Canva export directory is required.');
    const init = await createInitRun({
      repoRoot: deps.repoRoot,
      moduleDir: deps.initModuleDir,
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

  if (kind === 'figma' && !deps.input.figmaUrl?.trim()) throw new Error('A Figma file URL is required.');
  if (kind === 'indesign' && !deps.input.indesignFile?.trim())
    throw new Error('An .idml or .pdf file is required.');

  // One vars bag for every conversion descriptor; fillTemplate uses whichever
  // placeholders the manifest's argsTemplate actually references.
  const vars = {
    figmaUrl: deps.input.figmaUrl?.trim() ?? '',
    file: deps.input.indesignFile?.trim() ?? '',
    slug,
  };
  const spec = await buildCommandSpec(deps.commands, deps.repoRoot, deps.command, vars);

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
