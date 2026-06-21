import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { isAbsolute, relative, resolve } from 'node:path';
import { IPC } from '../../shared/ipc-channels';
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
import { createPrereqRun } from '../../core/prerequisites/run-prerequisites';
import { createInitRun } from '../../core/init/run-init';
import { createPipelineRun } from '../../core/pipelines/pipeline-run';
import { dockerCommandSpec } from '../../core/docker/docker-commands';
import { parseComposePs } from '../../core/docker/docker-status';
import { listThemeDirs } from '../../core/project/list-themes';
import { validateRepoRoot } from '../../core/project/locate-root';
import { qaCommandSpec } from '../../core/qa/qa-commands';
import { discoverQaArtifacts } from '../../core/qa/discover';
import { readImageDataUrl, readTextArtifact } from '../../core/fs/read-artifact';
import { getScriptsDir } from '../paths';
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
}

/**
 * Wires the typed IPC surface to core. The renderer can only invoke these named
 * operations — never an arbitrary command. Sub-issues 2–6 add a handler here per
 * new typed FlavianBridge method.
 */
export function registerHandlers(deps: HandlerDeps): void {
  const runner = new ChildProcessRunner();
  const commands = new CommandBuilder(new DefaultShellResolver());
  // Results keyed by task id, awaited by the matching get*Result handler.
  const prereqResults = new Map<string, Promise<PrereqReport>>();
  const initResults = new Map<string, Promise<InitResult>>();
  const pipelineResults = new Map<string, Promise<PipelineResult>>();

  ipcMain.handle(IPC.projectGet, (): ProjectRef => deps.project.current);

  ipcMain.handle(IPC.projectSelect, async (): Promise<ProjectRef> => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const options = {
      title: 'Select your Flavian project folder',
      message: 'Choose the directory that contains wordpress-local.sh and scripts/.',
      properties: ['openDirectory' as const],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return deps.project.current;

    const ref = await validateRepoRoot(result.filePaths[0]);
    if (ref.valid) {
      deps.project.current = ref;
      await saveSettings({ projectRoot: ref.root });
    }
    return ref; // invalid refs carry a reason for the renderer to surface
  });

  ipcMain.handle(IPC.prereqRun, async (): Promise<{ taskId: string }> => {
    const prereq = await createPrereqRun({
      runner,
      commands,
      scriptsDir: getScriptsDir(deps.project.current.root),
      repoRoot: deps.project.current.root,
    });
    const task = deps.taskManager.create({
      kind: 'prereq-check',
      run: prereq.run,
      // Exit 1 ("requirements missing") is a valid result, not a task failure.
      isSuccess: (result) => result.code === 0 || result.code === 1,
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
    const init = await createInitRun({ repoRoot: deps.project.current.root, input });
    const task = deps.taskManager.create({ kind: 'init', run: init.run });
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
      const spec = await dockerCommandSpec(commands, deps.project.current.root, command, arg);
      const task = deps.taskManager.create({
        kind: `docker:${command}`,
        run: (onEvent) => runner.run(spec, onEvent),
      });
      deps.bridge.attach(task);
      task.start();
      return { taskId: task.id };
    },
  );

  ipcMain.handle(IPC.dockerStatus, async (): Promise<DockerService[]> => {
    const spec = await commands.dockerCompose(['ps', '--format', 'json'], deps.project.current.root);
    const { stdout } = await collectOutput(runner, spec);
    return parseComposePs(stdout);
  });

  ipcMain.handle(IPC.listThemes, (): Promise<string[]> => listThemeDirs(deps.project.current.root));

  ipcMain.handle(IPC.pipelineRun, async (_event, input: PipelineInput): Promise<{ taskId: string }> => {
    const pipeline = await createPipelineRun({
      repoRoot: deps.project.current.root,
      input,
      runner,
      commands,
    });
    const task = deps.taskManager.create({ kind: `pipeline:${input.kind}`, run: pipeline.run });
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
    const spec = await qaCommandSpec(commands, deps.project.current.root, script);
    const task = deps.taskManager.create({
      kind: `qa:${script}`,
      run: (onEvent) => runner.run(spec, onEvent),
    });
    deps.bridge.attach(task);
    task.start();
    return { taskId: task.id };
  });

  ipcMain.handle(IPC.qaArtifacts, (): Promise<QaArtifacts> => discoverQaArtifacts(deps.project.current.root));

  ipcMain.handle(IPC.qaImage, (_event, relPath: string): Promise<string | null> =>
    readImageDataUrl(deps.project.current.root, relPath),
  );

  ipcMain.handle(IPC.qaText, (_event, relPath: string): Promise<string | null> =>
    readTextArtifact(deps.project.current.root, relPath),
  );

  ipcMain.handle(IPC.openExternal, async (_event, url: string): Promise<void> => {
    if (/^https?:\/\//i.test(url)) await shell.openExternal(url);
  });

  ipcMain.handle(IPC.openPath, async (_event, relPath: string): Promise<string> => {
    // Open a project-relative doc; refuse traversal and non-text targets.
    const target = resolve(deps.project.current.root, relPath);
    const rel = relative(deps.project.current.root, target).replace(/\\/g, '/');
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
