import { promises as fs } from 'node:fs';
import { posix as pposix, win32 as pwin32 } from 'node:path';

/** Thrown when no POSIX shell can be found to run the repo's `.sh` scripts. */
export class ShellNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShellNotFoundError';
  }
}

export interface ShellResolver {
  /** Absolute path to a bash capable of running the repo's `.sh` scripts. */
  resolveBash(): Promise<string>;
  /** Absolute path to a directly-invokable tool, or null if absent. */
  resolveTool(name: 'node' | 'pnpm' | 'docker' | 'claude' | (string & {})): Promise<string | null>;
}

/**
 * Injectable platform surface — real implementation reads the live OS, tests pass
 * a fake so a Windows resolution path can be exercised on a Linux CI runner.
 */
export interface ResolverEnv {
  platform: NodeJS.Platform;
  env: Record<string, string | undefined>;
  fileExists(path: string): Promise<boolean>;
}

const realEnv: ResolverEnv = {
  platform: process.platform,
  env: process.env,
  fileExists: async (p) => {
    try {
      return (await fs.stat(p)).isFile();
    } catch {
      return false;
    }
  },
};

export class DefaultShellResolver implements ShellResolver {
  private bashCache: string | null = null;

  constructor(private readonly re: ResolverEnv = realEnv) {}

  async resolveBash(): Promise<string> {
    if (this.bashCache) return this.bashCache;
    const { platform, env } = this.re;

    // 1. Explicit override (escape hatch / test injection).
    const override = env.FLAVIAN_BASH;
    if (override && (await this.re.fileExists(override))) {
      return (this.bashCache = override);
    }

    if (platform === 'win32') {
      // 2. Known Git Bash locations.
      for (const candidate of this.gitBashCandidates()) {
        if (await this.re.fileExists(candidate)) return (this.bashCache = candidate);
      }
      // 3. PATH — excluding the WSL launcher at C:\Windows\System32\bash.exe, which
      //    would run scripts inside the Linux filesystem namespace, not the checkout.
      const onPath = await this.findOnPath('bash.exe', { excludeSystem32: true });
      if (onPath) return (this.bashCache = onPath);
    } else {
      for (const candidate of ['/bin/bash', '/usr/bin/bash', '/usr/local/bin/bash']) {
        if (await this.re.fileExists(candidate)) return (this.bashCache = candidate);
      }
      const onPath = await this.findOnPath('bash');
      if (onPath) return (this.bashCache = onPath);
    }

    throw new ShellNotFoundError(
      platform === 'win32'
        ? 'No bash found. Install Git for Windows (https://git-scm.com/download/win) — it includes Git Bash — then restart the app.'
        : 'No bash found on PATH. Install bash via your system package manager.',
    );
  }

  async resolveTool(name: string): Promise<string | null> {
    const names = this.re.platform === 'win32' ? [`${name}.exe`, `${name}.cmd`, name] : [name];
    for (const n of names) {
      const found = await this.findOnPath(n);
      if (found) return found;
    }
    return null;
  }

  private gitBashCandidates(): string[] {
    const { env } = this.re;
    return [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      env.LOCALAPPDATA ? pwin32.join(env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe') : null,
    ].filter((x): x is string => Boolean(x));
  }

  private async findOnPath(
    file: string,
    opts: { excludeSystem32?: boolean } = {},
  ): Promise<string | null> {
    // Use the path flavor matching the SIMULATED platform, not the host's, so the
    // resolver behaves identically wherever the tests run.
    const path = this.re.platform === 'win32' ? pwin32 : pposix;
    const sep = this.re.platform === 'win32' ? ';' : ':';
    const pathVar = this.re.env.PATH ?? this.re.env.Path ?? '';
    for (const dir of pathVar.split(sep).filter(Boolean)) {
      if (opts.excludeSystem32 && /\\system32\\?$/i.test(dir)) continue;
      const full = path.join(dir, file);
      if (await this.re.fileExists(full)) return full;
    }
    return null;
  }
}
