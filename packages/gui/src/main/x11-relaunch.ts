/**
 * Self-relaunch with Ozone pinned to X11 (issue #190).
 *
 * Electron 42 resolves its Ozone (display) backend before this script runs, picks Wayland on a
 * Wayland desktop, and then segfaults creating its first window on Ubuntu 26.04. Neither
 * `app.commandLine.appendSwitch` nor `ELECTRON_OZONE_PLATFORM_HINT` changes that choice; only
 * `--ozone-platform=x11` on the real command line does. The launchers this package owns pass it
 * up front (scripts/launch-flags.mjs, the AppImage's desktop entry). For any other launcher (a
 * bare `electron out/main/index.js`, the unpacked binary, an AppImage started from a terminal)
 * the main process starts itself over once with the pin. The decision is a pure function so it
 * is unit-tested without Electron; src/main/index.ts applies it with `app.relaunch`.
 */

export interface RelaunchInput {
  readonly platform: NodeJS.Platform;
  /** process.argv.slice(1): what the launcher passed. Switches Electron adds itself are not here. */
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  /** app.commandLine.getSwitchValue('ozone-platform'): the backend Electron resolved before JS ran. */
  readonly selectedOzonePlatform: string;
}

/** What to hand to `app.relaunch`. `execPath` is set only when the running binary must not be reused. */
export interface RelaunchPlan {
  readonly execPath?: string;
  readonly args: readonly string[];
}

const X11_SWITCH = '--ozone-platform=x11';

const isSet = (value: string | undefined): value is string => value !== undefined && value !== '';

/**
 * Relaunch only when Electron chose Wayland on Linux and nobody asked for a backend: a caller who
 * passed any `--ozone-platform…` switch (that includes our own relaunched process, so there is no
 * loop) or set `ELECTRON_OZONE_PLATFORM_HINT` made their choice. Inside an AppImage the mount
 * disappears with the first process, so the relaunch targets the AppImage file (`APPIMAGE`).
 */
export function x11RelaunchPlan(input: RelaunchInput): RelaunchPlan | null {
  const { platform, argv, env, selectedOzonePlatform } = input;
  if (platform !== 'linux' || selectedOzonePlatform !== 'wayland') return null;
  if (argv.some((arg) => arg.startsWith('--ozone-platform'))) return null;
  if (isSet(env['ELECTRON_OZONE_PLATFORM_HINT'])) return null;
  const args = [X11_SWITCH, ...argv];
  const appImage = env['APPIMAGE'];
  return isSet(appImage) ? { execPath: appImage, args } : { args };
}
