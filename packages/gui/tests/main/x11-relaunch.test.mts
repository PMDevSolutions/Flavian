import { test } from 'node:test';
import assert from 'node:assert/strict';
import { x11RelaunchPlan } from '../../src/main/x11-relaunch';

// Electron 42 resolves its Ozone backend before the main script runs, picks Wayland on a Wayland
// desktop and segfaults creating its first window on Ubuntu 26.04 (issue #190). Launchers this
// package owns pass --ozone-platform=x11 up front; for any other launcher the main process starts
// itself over with the pin. These tests fix when that relaunch happens and what it runs.

const base = { platform: 'linux' as const, env: {}, selectedOzonePlatform: 'wayland' };

test('Electron on Wayland with no caller-chosen backend relaunches with X11 pinned', () => {
  assert.deepEqual(x11RelaunchPlan({ ...base, argv: ['out/main/index.js'] }), {
    args: ['--ozone-platform=x11', 'out/main/index.js'],
  });
});

test('an X11 session, where Electron already chose x11, does not relaunch', () => {
  assert.equal(x11RelaunchPlan({ ...base, argv: [], selectedOzonePlatform: 'x11' }), null);
});

test('the relaunched process, which carries the pin in its argv, never relaunches again', () => {
  assert.equal(x11RelaunchPlan({ ...base, argv: ['--ozone-platform=x11', 'out/main/index.js'] }), null);
});

test('a backend the caller chose explicitly is respected', () => {
  assert.equal(x11RelaunchPlan({ ...base, argv: ['--ozone-platform=wayland'] }), null);
  assert.equal(x11RelaunchPlan({ ...base, argv: ['--ozone-platform-hint=auto'] }), null);
  assert.equal(
    x11RelaunchPlan({ ...base, argv: [], env: { ELECTRON_OZONE_PLATFORM_HINT: 'wayland' } }),
    null,
  );
});

test('macOS and Windows never relaunch', () => {
  assert.equal(x11RelaunchPlan({ ...base, platform: 'darwin', argv: [] }), null);
  assert.equal(x11RelaunchPlan({ ...base, platform: 'win32', argv: [] }), null);
});

test('when Electron reports no backend at all there is nothing to fix', () => {
  assert.equal(x11RelaunchPlan({ ...base, argv: [], selectedOzonePlatform: '' }), null);
});

test('inside an AppImage the relaunch targets the AppImage file, not the mounted binary', () => {
  const plan = x11RelaunchPlan({
    ...base,
    argv: ['--no-sandbox'],
    env: { APPIMAGE: '/home/u/Downloads/Flavian-2.1.2.AppImage' },
  });
  assert.deepEqual(plan, {
    execPath: '/home/u/Downloads/Flavian-2.1.2.AppImage',
    args: ['--ozone-platform=x11', '--no-sandbox'],
  });
});
