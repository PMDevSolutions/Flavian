#!/usr/bin/env node
/**
 * Starts `electron-vite <dev|preview>` with the Electron launch flags this platform needs.
 *
 * Usage: node scripts/run-electron-vite.mjs <dev|preview> [electron-vite options] [-- electron args]
 *
 * On Linux the app must start with --ozone-platform=x11 (Electron 42 segfaults on Wayland
 * desktops otherwise, issue #190); electron-vite forwards whatever follows its `--` separator
 * to Electron, so that is where the switch goes. The child also never inherits
 * ELECTRON_RUN_AS_NODE from an editor-hosted shell. Both rules live in ./launch-flags.mjs.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { electronLaunchEnv, electronViteArgv } from './launch-flags.mjs';

const [command, ...userArgs] = process.argv.slice(2);
if (command !== 'dev' && command !== 'preview') {
  console.error('usage: run-electron-vite.mjs <dev|preview> [electron-vite options] [-- electron args]');
  process.exit(2);
}

// electron-vite's package exports expose package.json but not bin/, so locate the CLI from there
// and run it with the current Node binary (no shell, so it behaves the same on Windows).
const packageJson = createRequire(import.meta.url).resolve('electron-vite/package.json');
const cli = join(dirname(packageJson), 'bin', 'electron-vite.js');

const child = spawn(process.execPath, [cli, ...electronViteArgv(command, userArgs, process.platform)], {
  stdio: 'inherit',
  env: electronLaunchEnv(process.env),
});
child.on('error', (err) => {
  console.error(`run-electron-vite: failed to start electron-vite: ${err.message}`);
  process.exit(1);
});
// A supervisor stopping this runner (Ctrl-C, `timeout`, an IDE task) must stop electron-vite
// and the Electron it spawned too, not orphan them.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
