import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { activeManifest } from '../shared/product';
import { TaskManager } from '../core/task/task-manager';
import { resolveInitialProject } from './env';
import { createTaskBridge } from './ipc/task-bridge';
import { registerHandlers } from './ipc/register-handlers';
import { createWindow, installCsp } from './window';
import { x11RelaunchPlan } from './x11-relaunch';

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

// Electron resolved its Ozone backend before this script ran and segfaults on Wayland desktops
// at the first window (issue #190). Launchers we own pass --ozone-platform=x11; for any other
// launcher, start over once with it instead of booting into the crash.
const relaunch = x11RelaunchPlan({
  platform: process.platform,
  argv: process.argv.slice(1),
  env: process.env,
  selectedOzonePlatform: app.commandLine.getSwitchValue('ozone-platform'),
});
if (relaunch) {
  app.relaunch({ ...(relaunch.execPath ? { execPath: relaunch.execPath } : {}), args: [...relaunch.args] });
  app.exit(0);
} else {
  start();
}

function start(): void {
app.whenReady().then(
  async () => {
    // The project context is mutable: the renderer's "Open project folder" action
    // updates `current`, and every handler reads it live.
    const project = { current: await resolveInitialProject(activeManifest) };

    installCsp(app.isPackaged);
    // Registered once (handlers are global); windows are created/recreated freely.
    // The active manifest is injected here — the single point that names the product.
    registerHandlers({
      taskManager: new TaskManager(),
      project,
      bridge: createTaskBridge(),
      manifest: activeManifest,
    });

    await openWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void openWindow();
    });
  },
  (err: unknown) => {
    console.error(`Failed to start ${activeManifest.displayName} GUI:`, err);
    app.quit();
  },
);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
}
