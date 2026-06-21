import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { TaskManager } from '../core/task/task-manager';
import { resolveProjectRef } from './env';
import { createTaskBridge } from './ipc/task-bridge';
import { registerHandlers } from './ipc/register-handlers';
import { createWindow, installCsp } from './window';

async function bootstrap(): Promise<void> {
  const projectRef = await resolveProjectRef();
  const taskManager = new TaskManager();

  installCsp(app.isPackaged);

  // electron-vite emits CJS main/preload as out/main and out/preload siblings.
  const preloadPath = join(__dirname, '../preload/index.js');
  const win = createWindow(preloadPath);
  const bridge = createTaskBridge(win);
  registerHandlers({ taskManager, projectRef, bridge });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    await win.loadURL(devUrl);
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(
  () => {
    void bootstrap();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void bootstrap();
    });
  },
  (err) => {
    console.error('Failed to start Flavian GUI:', err);
    app.quit();
  },
);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
