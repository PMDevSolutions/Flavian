import { BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron';
import { isAbsolute, relative, resolve } from 'node:path';
import { IPC } from '../../shared/ipc-channels';
import type { ProductManifest } from '../../shared/product/manifest';
import { getScreen, getStep, initModuleDir, soleStep } from '../../shared/product';
import type { DockerCommand, DockerService } from '../../shared/types/docker';
import type { InitInput, InitResult } from '../../shared/types/init';
import type { PipelineInput, PipelineResult } from '../../shared/types/pipeline';
import type { PrereqReport } from '../../shared/types/prerequisites';
import type { QaArtifacts, QaScript } from '../../shared/types/qa';
import type { ProjectRef } from '../../shared/types/project';
import type { TaskSnapshot } from '../../shared/types/task';
import type { TaskManager } from '../../core/task/task-manager';
import { ChildProcessRunner } from '../../core/process/process-runner';
import { CommandBuilder } from '../../core/shell/command-builder';
import { DefaultShellResolver } from '../../core/shell/shell-resolver';
import { collectOutput } from '../../core/process/collect';
import { buildCommandSpec } from '../../core/product/command-spec';
import { streamResultParser } from '../../core/product/parsers';
import { createPrereqRun } from '../../core/prerequisites/run-prerequisites';
import { createInitRun } from '../../core/init/run-init';
import { createPipelineRun } from '../../core/pipelines/pipeline-run';
import { parseComposePs } from '../../core/docker/docker-status';
import { listThemeDirs } from '../../core/project/list-themes';
import { validateRepoRoot } from '../../core/project/locate-root';
import { discoverQaArtifacts } from '../../core/qa/discover';
import { readImageDataUrl, readTextArtifact } from '../../core/fs/read-artifact';
import { saveSettings } from '../settings';
import type { TaskBridge } from './task-bridge';

/** Mutable holder so the user can switch the active project at runtime. */
export interface ProjectContext {
  current: ProjectRef;
}

export interface HandlerDeps {
  taskManager: TaskManager;
  project: ProjectContext;
  bridge: TaskBridge;
  /** The active product manifest — the ONLY source of product-specific knowledge. */
  manifest: ProductManifest;
}

/**
 * Wires the typed IPC surface to core. Every product specific — which script a step
 * runs, how its output is parsed, the project-detection copy — is read from
 * `deps.manifest`; this file is generic engine. A different product is driven by
 * injecting a different manifest (see main/index.ts), not by editing this file.
 */
export function registerHandlers(deps: HandlerDeps): void {
  const runner = new ChildProcessRunner();
  const commands = new CommandBuilder(new DefaultShellResolver());
  const { manifest } = deps;
  const root = (): string => deps.project.current.root;
  // Results keyed by task id, awaited by the matching get*Result handler.
  const prereqResults = new Map<string, Promise<PrereqReport>>();
  const initResults = new Map<string, Promise<InitResult>>();
  const pipelineResults = new Map<string, Promise<PipelineResult>>();

  // Open a native dialog parented to the active window (or window-less if none).
  const showOpen = (options: OpenDialogOptions) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options);
  };

  ipcMain.handle(IPC.projectGet, (): ProjectRef => deps.project.current);

  ipcMain.handle(IPC.projectSelect, async (): Promise<ProjectRef> => {
    const result = await showOpen({
      title: manifest.project.selectTitle,
      message: manifest.project.selectMessage,
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return deps.project.current;

    const ref = await validateRepoRoot(result.filePaths[0], manifest.project);
    if (ref.valid) {
      deps.project.current = ref;
      await saveSettings({ projectRoot: ref.root });
    }
    return ref; // invalid refs carry a reason for the renderer to surface
  });

  ipcMain.handle(IPC.dialogDirectory, async (): Promise<string | null> => {
    const result = await showOpen({ properties: ['openDirectory'] });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.dialogFile, async (_event, extensions: string[]): Promise<string | null> => {
    const result = await showOpen({
      properties: ['openFile'],
      filters: [{ name: 'Supported files', extensions }],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.prereqRun, async (): Promise<{ taskId: string }> => {
    const step = soleStep(manifest, 'prereq');
    const spec = await buildCommandSpec(commands, root(), step.command);
    const prereq = createPrereqRun({ runner, spec, parse: streamResultParser(step.parser) });
    const task = deps.taskManager.create({
      kind: step.taskKind,
      run: prereq.run,
      // Exit 1 ("requirements missing") is a valid result, not a task failure.
      isSuccess: (result) => (step.successExitCodes ?? [0]).includes(result.code ?? -1),
    });
    deps.bridge.attach(task);
    prereqResults.set(task.id, prereq.result);
    task.start();
    return { taskId: task.id };
  });

  ipcMain.handle(IPC.prereqResult, async (_event, taskId: string): Promise<PrereqReport> => {
    const result = prereqResults.get(taskId);
    if (!result) throw new Error(`Unknown prereq task: ${taskId}`);
    return result;
  });

  ipcMain.handle(IPC.initRun, async (_event, input: InitInput): Promise<{ taskId: string }> => {
    // createInitRun validates via resolveDefaults and throws on bad input — that
    // rejection surfaces to the renderer before any task is created.
    const init = await createInitRun({
      repoRoot: root(),
      moduleDir: initModuleDir(manifest),
      input,
    });
    const task = deps.taskManager.create({ kind: soleStep(manifest, 'wizard').taskKind, run: init.run });
    deps.bridge.attach(task);
    initResults.set(task.id, init.result);
    task.start();
    return { taskId: task.id };
  });

  ipcMain.handle(IPC.initResult, async (_event, taskId: string): Promise<InitResult> => {
    const result = initResults.get(taskId);
    if (!result) throw new Error(`Unknown init task: ${taskId}`);
    return result;
  });

  ipcMain.handle(
    IPC.dockerRun,
    async (_event, command: DockerCommand, arg?: string): Promise<{ taskId: string }> => {
      const step = getStep(getScreen(manifest, 'docker'), command);
      const spec = await buildCommandSpec(commands, root(), step.command, arg !== undefined ? { theme: arg } : {});
      const task = deps.taskManager.create({
        kind: step.taskKind,
        run: (onEvent) => runner.run(spec, onEvent),
      });
      deps.bridge.attach(task);
      task.start();
      return { taskId: task.id };
    },
  );

  ipcMain.handle(IPC.dockerStatus, async (): Promise<DockerService[]> => {
    const spec = await commands.dockerCompose(['ps', '--format', 'json'], root());
    const { stdout } = await collectOutput(runner, spec);
    return parseComposePs(stdout);
  });

  ipcMain.handle(IPC.listThemes, (): Promise<string[]> => listThemeDirs(root()));

  ipcMain.handle(IPC.pipelineRun, async (_event, input: PipelineInput): Promise<{ taskId: string }> => {
    const step = getStep(getScreen(manifest, 'pipeline'), input.kind);
    const pipeline = await createPipelineRun({
      repoRoot: root(),
      input,
      runner,
      commands,
      command: step.command,
      initModuleDir: initModuleDir(manifest),
    });
    const task = deps.taskManager.create({ kind: step.taskKind, run: pipeline.run });
    deps.bridge.attach(task);
    pipelineResults.set(task.id, pipeline.result);
    task.start();
    return { taskId: task.id };
  });

  ipcMain.handle(IPC.pipelineResult, async (_event, taskId: string): Promise<PipelineResult> => {
    const result = pipelineResults.get(taskId);
    if (!result) throw new Error(`Unknown pipeline task: ${taskId}`);
    return result;
  });

  ipcMain.handle(IPC.qaRun, async (_event, script: QaScript): Promise<{ taskId: string }> => {
    const step = getStep(getScreen(manifest, 'qa'), script);
    const spec = await buildCommandSpec(commands, root(), step.command);
    const task = deps.taskManager.create({
      kind: step.taskKind,
      run: (onEvent) => runner.run(spec, onEvent),
    });
    deps.bridge.attach(task);
    task.start();
    return { taskId: task.id };
  });

  ipcMain.handle(IPC.qaArtifacts, (): Promise<QaArtifacts> => discoverQaArtifacts(root()));

  ipcMain.handle(IPC.qaImage, (_event, relPath: string): Promise<string | null> =>
    readImageDataUrl(root(), relPath),
  );

  ipcMain.handle(IPC.qaText, (_event, relPath: string): Promise<string | null> =>
    readTextArtifact(root(), relPath),
  );

  ipcMain.handle(IPC.openExternal, async (_event, url: string): Promise<void> => {
    if (/^https?:\/\//i.test(url)) await shell.openExternal(url);
  });

  ipcMain.handle(IPC.openPath, async (_event, relPath: string): Promise<string> => {
    // Open a project-relative doc; refuse traversal and non-text targets.
    const target = resolve(root(), relPath);
    const rel = relative(root(), target).replace(/\\/g, '/');
    if (rel === '' || rel.startsWith('../') || isAbsolute(rel) || !/\.(md|txt)$/i.test(rel)) {
      return 'Path not allowed';
    }
    return shell.openPath(target);
  });

  ipcMain.handle(IPC.taskSnapshot, (_event, taskId: string): TaskSnapshot | null =>
    deps.taskManager.snapshot(taskId),
  );

  ipcMain.handle(IPC.taskCancel, (_event, taskId: string): void => {
    deps.taskManager.cancel(taskId);
  });
}
