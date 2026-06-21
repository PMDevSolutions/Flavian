/**
 * Single source of truth for IPC channel names, imported by preload, main and
 * (indirectly) renderer. Request/response channels pair with ipcMain.handle /
 * ipcRenderer.invoke; `taskEvent` is a main → renderer push (webContents.send).
 */
export const IPC = {
  // request / response
  projectGet: 'flavian:project:get',
  prereqRun: 'flavian:prereq:run',
  prereqResult: 'flavian:prereq:result',
  taskSnapshot: 'flavian:task:snapshot',
  taskCancel: 'flavian:task:cancel',
  // main → renderer push
  taskEvent: 'flavian:task:event',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
