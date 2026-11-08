/**
 * Electron launch flags shared by every launcher this package owns: the dev/preview
 * runner (run-electron-vite.mjs) and the smoke test. The packaged Linux app gets the same
 * flags from electron-builder.yml (appImage.executableArgs).
 *
 * Why: Electron 42 selects its Ozone (display) backend before any main-process JavaScript
 * runs, picks Wayland on a Wayland session, and then segfaults creating its first window on
 * Ubuntu 26.04 (issue #190). Neither `app.commandLine.appendSwitch` nor
 * `ELECTRON_OZONE_PLATFORM_HINT` changes that choice; only `--ozone-platform=x11` on the
 * real command line does, so the pin has to be applied by whatever starts Electron.
 */

/** Pins Chromium's Ozone backend to X11 (XWayland on a Wayland desktop). */
export const X11_SWITCH = '--ozone-platform=x11';

/**
 * Electron command-line switches a launcher must pass on `platform` (process.platform).
 * Linux always gets the X11 pin: on an X11 session it is what Electron picks anyway.
 * @param {string} platform
 * @returns {string[]}
 */
export function electronLaunchArgs(platform) {
  return platform === 'linux' ? [X11_SWITCH] : [];
}

/**
 * The environment to start Electron with. Editor-hosted shells (VS Code) export
 * ELECTRON_RUN_AS_NODE=1, which turns the Electron binary into plain Node with no `app`
 * API; the launched app must never inherit it.
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string | undefined>}
 */
export function electronLaunchEnv(env) {
  const launchEnv = { ...env };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  return launchEnv;
}

/**
 * argv for `electron-vite <command>`: the user's electron-vite options first, then the
 * Electron switches after electron-vite's `--` separator. A switch the user already chose
 * after `--` (any `--ozone-platform…`) wins over the pin.
 * @param {'dev' | 'preview'} command
 * @param {readonly string[]} userArgs   everything after the command on our own command line
 * @param {string} platform
 * @returns {string[]}
 */
export function electronViteArgv(command, userArgs, platform) {
  const separator = userArgs.indexOf('--');
  const viteArgs = separator === -1 ? [...userArgs] : userArgs.slice(0, separator);
  const electronArgs = separator === -1 ? [] : userArgs.slice(separator + 1);
  const pinned = electronLaunchArgs(platform).filter((flag) => {
    const name = flag.split('=')[0];
    return !electronArgs.some((arg) => arg.startsWith(name));
  });
  const allElectronArgs = [...electronArgs, ...pinned];
  return allElectronArgs.length > 0
    ? [command, ...viteArgs, '--', ...allElectronArgs]
    : [command, ...viteArgs];
}
