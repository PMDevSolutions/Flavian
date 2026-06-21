import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { TaskManager } from '../core/task/task-manager';
import { resolveInitialProject } from './env';
import { createTaskBridge } from './ipc/task-bridge';
import { registerHandlers } from './ipc/register-handlers';
import { createWindow, installCsp } from './window';

async function openWindow(): Promise<void> {
  // electron-vite emits CJS main/preload as out/main and out/preload siblings.
  const win = createWindow(join(__dirname, '../preload/index.js'));
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    await win.loadURL(devUrl);
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(
  async () => {
    // The project context is mutable: the renderer's "Open project folder" action
    // updates `current`, and every handler reads it live.
    const project = { current: await resolveInitialProject() };

    installCsp(app.isPackaged);
    // Registered once (handlers are global); windows are created/recreated freely.
    registerHandlers({ taskManager: new TaskManager(), project, bridge: createTaskBridge() });

    await openWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void openWindow();
    });
  },
  (err: unknown) => {
    console.error('Failed to start Flavian GUI:', err);
    app.quit();
  },
);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
