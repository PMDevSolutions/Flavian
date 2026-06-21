import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DefaultShellResolver,
  ShellNotFoundError,
  type ResolverEnv,
} from '../../../src/core/shell/shell-resolver';

function fakeEnv(over: {
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
  exists?: string[];
}): ResolverEnv {
  const existing = new Set(over.exists ?? []);
  return {
    platform: over.platform ?? 'linux',
    env: over.env ?? {},
    fileExists: async (p) => existing.has(p),
  };
}

test('FLAVIAN_BASH override wins when it exists', async () => {
  const resolver = new DefaultShellResolver(
    fakeEnv({ platform: 'win32', env: { FLAVIAN_BASH: 'D:\\tools\\bash.exe' }, exists: ['D:\\tools\\bash.exe'] }),
  );
  assert.equal(await resolver.resolveBash(), 'D:\\tools\\bash.exe');
});

test('Windows resolves a known Git Bash location', async () => {
  const resolver = new DefaultShellResolver(
    fakeEnv({ platform: 'win32', exists: ['C:\\Program Files\\Git\\bin\\bash.exe'] }),
  );
  assert.equal(await resolver.resolveBash(), 'C:\\Program Files\\Git\\bin\\bash.exe');
});

test('Windows PATH search excludes the WSL System32 bash', async () => {
  const resolver = new DefaultShellResolver(
    fakeEnv({
      platform: 'win32',
      env: { PATH: 'C:\\Windows\\System32;C:\\tools\\git\\bin' },
      exists: ['C:\\Windows\\System32\\bash.exe', 'C:\\tools\\git\\bin\\bash.exe'],
    }),
  );
  assert.equal(await resolver.resolveBash(), 'C:\\tools\\git\\bin\\bash.exe');
});

test('throws ShellNotFoundError when only WSL bash is present', async () => {
  const resolver = new DefaultShellResolver(
    fakeEnv({
      platform: 'win32',
      env: { PATH: 'C:\\Windows\\System32' },
      exists: ['C:\\Windows\\System32\\bash.exe'],
    }),
  );
  await assert.rejects(() => resolver.resolveBash(), ShellNotFoundError);
});

test('resolveTool finds a tool on PATH or returns null', async () => {
  const resolver = new DefaultShellResolver(
    fakeEnv({ platform: 'linux', env: { PATH: '/usr/bin:/usr/local/bin' }, exists: ['/usr/local/bin/docker'] }),
  );
  assert.equal(await resolver.resolveTool('docker'), '/usr/local/bin/docker');
  assert.equal(await resolver.resolveTool('nonexistent-xyz'), null);
});
