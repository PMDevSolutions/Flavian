import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createPrereqRun } from '../../../src/core/prerequisites/run-prerequisites';
import { CommandBuilder } from '../../../src/core/shell/command-builder';
import type { ShellResolver } from '../../../src/core/shell/shell-resolver';
import type {
  ProcessEvent,
  ProcessResult,
  ProcessRunner,
  RunHandle,
  RunSpec,
} from '../../../src/core/process/runner-types';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): Promise<string> =>
  readFile(join(here, '..', '..', 'fixtures', name), 'utf8');

const fakeShell: ShellResolver = {
  resolveBash: async () => 'bash',
  resolveTool: async () => null,
};

/** A ProcessRunner that replays a fixed transcript, then exits with a code. */
class FakeRunner implements ProcessRunner {
  lastSpec: RunSpec | null = null;
  constructor(
    private readonly transcript: string,
    private readonly code: number,
  ) {}
  run(spec: RunSpec, onEvent: (e: ProcessEvent) => void): RunHandle {
    this.lastSpec = spec;
    let settle!: (r: ProcessResult) => void;
    const done = new Promise<ProcessResult>((resolve) => {
      settle = resolve;
    });
    queueMicrotask(() => {
      onEvent({ type: 'spawn', pid: 1234 });
      onEvent({ type: 'stdout', chunk: this.transcript });
      onEvent({ type: 'exit', code: this.code, signal: null });
      settle({ code: this.code, signal: null });
    });
    return { pid: 1234, done, cancel: () => {} };
  }
}

test('builds a bash RunSpec targeting check-prerequisites.sh and parses the report', async () => {
  const runner = new FakeRunner(await fixture('prereq-all-pass.txt'), 0);
  const prereq = await createPrereqRun({
    runner,
    commands: new CommandBuilder(fakeShell),
    scriptsDir: '/repo/scripts',
    repoRoot: '/repo',
  });

  assert.equal(prereq.spec.command, 'bash');
  assert.ok(prereq.spec.args[0]?.endsWith('check-prerequisites.sh'));

  prereq.run(() => {});
  const report = await prereq.result;
  assert.equal(report.ready, true);
  assert.equal(report.summary.requiredPassed, 3);
});

test('exit code 1 (missing requirements) still yields a parsed, not-ready report', async () => {
  const runner = new FakeRunner(await fixture('prereq-with-failures.txt'), 1);
  const prereq = await createPrereqRun({
    runner,
    commands: new CommandBuilder(fakeShell),
    scriptsDir: '/repo/scripts',
    repoRoot: '/repo',
  });

  prereq.run(() => {});
  const report = await prereq.result;
  assert.equal(report.ready, false);
  assert.equal(report.exitCode, 1);
});
