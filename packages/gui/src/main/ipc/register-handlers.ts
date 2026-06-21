import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import type { InitInput, InitResult } from '../../shared/types/init';
import type { PrereqReport } from '../../shared/types/prerequisites';
import type { ProjectRef } from '../../shared/types/project';
import type { TaskSnapshot } from '../../shared/types/task';
import type { TaskManager } from '../../core/task/task-manager';
import { ChildProcessRunner } from '../../core/process/process-runner';
import { CommandBuilder } from '../../core/shell/command-builder';
import { DefaultShellResolver } from '../../core/shell/shell-resolver';
import { createPrereqRun } from '../../core/prerequisites/run-prerequisites';
import { createInitRun } from '../../core/init/run-init';
import { getScriptsDir } from '../paths';
import type { TaskBridge } from './task-bridge';

export interface HandlerDeps {
  taskManager: TaskManager;
  projectRef: ProjectRef;
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

  ipcMain.handle(IPC.projectGet, (): ProjectRef => deps.projectRef);

  ipcMain.handle(IPC.prereqRun, async (): Promise<{ taskId: string }> => {
    const prereq = await createPrereqRun({
      runner,
      commands,
      scriptsDir: getScriptsDir(deps.projectRef.root),
      repoRoot: deps.projectRef.root,
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
    const init = await createInitRun({ repoRoot: deps.projectRef.root, input });
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

  ipcMain.handle(IPC.taskSnapshot, (_event, taskId: string): TaskSnapshot | null =>
    deps.taskManager.snapshot(taskId),
  );

  ipcMain.handle(IPC.taskCancel, (_event, taskId: string): void => {
    deps.taskManager.cancel(taskId);
  });
}
