// Types for launch-flags.mjs, so TypeScript callers (the node:test suites) type-check against it.
export const X11_SWITCH: '--ozone-platform=x11';
export function electronLaunchArgs(platform: string): string[];
export function electronLaunchEnv(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined>;
export function electronViteArgv(
  command: 'dev' | 'preview',
  userArgs: readonly string[],
  platform: string,
): string[];
