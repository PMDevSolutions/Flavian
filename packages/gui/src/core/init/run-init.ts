import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { InitInput, InitResult, MultisiteMode, ThemeStarter } from '../../shared/types/init';
import type { ProcessEvent, RunHandle } from '../process/runner-types';
import { makeAsyncRun } from '../process/async-run';
import { toInitFlags, type InitFlags } from './init-flags';

/** The config resolveDefaults() returns (see scripts/init/default-resolver.mjs). */
interface ResolvedInitConfig {
  projectName: string;
  siteTitle: string;
  themeStarter: ThemeStarter;
  canvaExport: string | null;
  woocommerce: boolean;
  multisite: boolean;
  multisiteMode: MultisiteMode;
  port: number;
  adminEmail: string;
  initGit: boolean;
}

type ResolveDefaults = (
  flags: InitFlags,
  env: { cwdBasename: string; gitEmail: string | null },
) => ResolvedInitConfig;
type Apply = (
  targetDir: string,
  config: ResolvedInitConfig,
  logger?: (line: string) => void,
) => Promise<void>;

export interface RunInitDeps {
  repoRoot: string;
  input: InitInput;
}

export interface InitRun {
  run: (onEvent: (event: ProcessEvent) => void) => RunHandle;
  result: Promise<InitResult>;
}

/**
 * Prepare a project-setup run. Dynamically imports the repo's own
 * default-resolver.mjs + apply.mjs (runtime file:// URLs so they're not bundled),
 * validates/normalizes the input via resolveDefaults (throws on bad input — the
 * caller surfaces it), then returns a Task-compatible run thunk that calls apply()
 * with its logger wired to the task's stream.
 */
export async function createInitRun(deps: RunInitDeps): Promise<InitRun> {
  const resolverUrl = pathToFileURL(
    join(deps.repoRoot, 'scripts', 'init', 'default-resolver.mjs'),
  ).href;
  const applyUrl = pathToFileURL(join(deps.repoRoot, 'scripts', 'init', 'apply.mjs')).href;

  const { resolveDefaults } = (await import(resolverUrl)) as { resolveDefaults: ResolveDefaults };
  const { apply } = (await import(applyUrl)) as { apply: Apply };

  const env = { cwdBasename: basename(deps.repoRoot), gitEmail: null };
  const config = resolveDefaults(toInitFlags(deps.input), env); // throws on invalid input

  let resolveResult!: (result: InitResult) => void;
  const result = new Promise<InitResult>((resolve) => {
    resolveResult = resolve;
  });

  const run = (onEvent: (event: ProcessEvent) => void): RunHandle => {
    const handle = makeAsyncRun(async (emit) => {
      await apply(deps.repoRoot, config, emit);
    })(onEvent);
    void handle.done.then((res) => {
      resolveResult({
        ok: res.code === 0,
        projectName: config.projectName,
        themeStarter: config.themeStarter,
        port: config.port,
        error: res.code === 0 ? undefined : 'Setup failed — see the log for details.',
      });
    });
    return handle;
  };

  return { run, result };
}
