import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

// electron-builder.yml and package.json together decide what electron-builder names the
// packaged binaries (gui-release.yml runs it on all three platforms). These tests pin the
// parts of that config the names depend on, so a Linux package build cannot silently
// regress again (issue #168).

interface BuilderConfig {
  productName?: string;
  executableName?: string;
  linux?: { executableName?: string };
}

const config = load(readFileSync(new URL('../../electron-builder.yml', import.meta.url), 'utf8')) as BuilderConfig;
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { name: string };

// The Linux packager names the binary after linux.executableName, then the top-level
// executableName, and otherwise after the package name with path separators stripped and
// lowercased (app-builder-lib/src/linuxPackager.ts): "@flavian/gui" becomes "@flaviangui".
function linuxExecutableName(): string {
  const explicit = config.linux?.executableName ?? config.executableName;
  return explicit ?? pkg.name.replace(/[/\\]/g, '').toLowerCase();
}

// Since electron-builder 26.8 the AppImage builder embeds the executable name in its bash
// launcher and in file paths, so it refuses any other character
// (app-builder-lib/src/targets/appimage/appImageUtil.ts, validateCriticalPathString).
const APPIMAGE_SAFE_NAME = /^[\p{L}\p{N}._\- ]+$/u;

test('the Linux executable name passes the AppImage builder name check', () => {
  const name = linuxExecutableName();
  assert.match(
    name,
    APPIMAGE_SAFE_NAME,
    `electron-builder would refuse to build the AppImage for executable name "${name}"`,
  );
});

test('macOS and Windows keep productName, so the bundle stays Flavian.app and Flavian.exe', () => {
  // A top-level executableName also renames the macOS bundle and the Windows exe
  // (app-builder-lib/src/appInfo.ts, productFilename); the Linux name belongs under linux:.
  assert.equal(config.productName, 'Flavian');
  assert.equal(config.executableName, undefined);
});

// Electron 42 segfaults on Wayland desktops (Ubuntu 26.04) unless Ozone is pinned to X11, and
// the pin only works as a real command-line argument (issue #190). For the packaged Linux app
// that argument has to come from the launcher electron-builder generates: appImage.executableArgs
// lands in the .desktop Exec line and in the AppImage's AppRun.
const appImageArgs = (config as { appImage?: { executableArgs?: string[] } }).appImage?.executableArgs ?? [];

test('the packaged Linux app launches with Ozone pinned to X11', () => {
  assert.ok(
    appImageArgs.includes('--ozone-platform=x11'),
    `appImage.executableArgs is ${JSON.stringify(appImageArgs)}; expected it to carry --ozone-platform=x11`,
  );
});

// electron-builder adds --no-sandbox to the AppImage launcher on its own (an AppImage cannot ship a
// SUID chrome-sandbox) but drops that default as soon as executableArgs is set
// (app-builder-lib/src/targets/AppImageTarget.ts), so the pin must carry it explicitly.
test('pinning Ozone keeps the AppImage launcher\'s --no-sandbox default', () => {
  assert.ok(appImageArgs.includes('--no-sandbox'), `appImage.executableArgs is ${JSON.stringify(appImageArgs)}`);
});
