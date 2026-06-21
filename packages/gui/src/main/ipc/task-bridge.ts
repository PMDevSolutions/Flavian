import { BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import type { TaskEventEnvelope } from '../../shared/types/ipc';
import type { Task } from '../../core/task/task';

export interface TaskBridge {
  /** Forward a task's streamed events to the renderer over the taskEvent channel. */
  attach(task: Task): void;
}

/**
 * Bridges core Task events onto the renderer(s). Broadcasts to all open windows so
 * it's independent of window lifecycle (handlers can be registered once at startup).
 * This is the only place core's in-process event stream crosses into Electron IPC.
 */
export function createTaskBridge(): TaskBridge {
  const broadcast = (envelope: TaskEventEnvelope): void => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.taskEvent, envelope);
    }
  };
  return {
    attach(task: Task): void {
      task.subscribe((event) => broadcast({ taskId: task.id, event }));
    },
  };
}
