import type { BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import type { TaskEventEnvelope } from '../../shared/types/ipc';
import type { Task } from '../../core/task/task';

export interface TaskBridge {
  /** Forward a task's streamed events to the renderer over the taskEvent channel. */
  attach(task: Task): void;
}

/**
 * Bridges core Task events onto the renderer. This is the ONLY place core's
 * in-process event stream crosses into Electron IPC; core stays Electron-free.
 */
export function createTaskBridge(win: BrowserWindow): TaskBridge {
  const send = (envelope: TaskEventEnvelope): void => {
    if (!win.isDestroyed()) win.webContents.send(IPC.taskEvent, envelope);
  };
  return {
    attach(task: Task): void {
      task.subscribe((event) => send({ taskId: task.id, event }));
    },
  };
}
