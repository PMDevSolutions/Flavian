import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  X11_SWITCH,
  electronLaunchArgs,
  electronLaunchEnv,
  electronViteArgv,
} from '../../scripts/launch-flags.mjs';

// Electron 42 picks the Wayland backend on its own before any main-process code runs and
// then segfaults creating its first window on Ubuntu 26.04 (issue #190). The only cure is
// `--ozone-platform=x11` on the real command line, so every launcher this package owns
// (dev/preview through electron-vite, the smoke test) derives its arguments and
// environment from these helpers.

test('Linux launches pin Ozone to X11', () => {
  assert.equal(X11_SWITCH, '--ozone-platform=x11');
  assert.deepEqual(electronLaunchArgs('linux'), ['--ozone-platform=x11']);
});

test('macOS and Windows launches add no switches', () => {
  assert.deepEqual(electronLaunchArgs('darwin'), []);
  assert.deepEqual(electronLaunchArgs('win32'), []);
});

test('the launch environment never carries ELECTRON_RUN_AS_NODE', () => {
  const env = electronLaunchEnv({ ELECTRON_RUN_AS_NODE: '1', PATH: '/usr/bin', HOME: '/home/u' });
  assert.deepEqual(env, { PATH: '/usr/bin', HOME: '/home/u' });
});

test('electron-vite receives the switches after the -- separator on Linux', () => {
  assert.deepEqual(electronViteArgv('dev', [], 'linux'), ['dev', '--', '--ozone-platform=x11']);
  assert.deepEqual(electronViteArgv('preview', [], 'linux'), ['preview', '--', '--ozone-platform=x11']);
});

test('electron-vite gets just the command elsewhere', () => {
  assert.deepEqual(electronViteArgv('dev', [], 'darwin'), ['dev']);
});

test('electron-vite options the user passes stay before the separator', () => {
  assert.deepEqual(electronViteArgv('dev', ['--inspect', '9229'], 'linux'), [
    'dev',
    '--inspect',
    '9229',
    '--',
    '--ozone-platform=x11',
  ]);
});

test('an Ozone platform the user chose after -- is respected, not overridden', () => {
  assert.deepEqual(electronViteArgv('dev', ['--', '--ozone-platform=wayland'], 'linux'), [
    'dev',
    '--',
    '--ozone-platform=wayland',
  ]);
  assert.deepEqual(electronViteArgv('dev', ['--', '--ozone-platform-hint=auto'], 'linux'), [
    'dev',
    '--',
    '--ozone-platform-hint=auto',
  ]);
});

test('other Electron switches the user passes after -- are kept alongside the pin', () => {
  assert.deepEqual(electronViteArgv('dev', ['--', '--trace-warnings'], 'linux'), [
    'dev',
    '--',
    '--trace-warnings',
    '--ozone-platform=x11',
  ]);
});
