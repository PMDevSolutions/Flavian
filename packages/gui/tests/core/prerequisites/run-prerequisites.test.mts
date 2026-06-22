import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createPrereqRun } from '../../../src/core/prerequisites/run-prerequisites';
import { buildCommandSpec } from '../../../src/core/product/command-spec';
import { streamResultParser } from '../../../src/core/product/parsers';
import { CommandBuilder } from '../../../src/core/shell/command-builder';
import { soleStep } from '../../../src/shared/product';
import { flavianManifest } from '../../../src/shared/product/flavian';
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

const prereqStep = soleStep(flavianManifest, 'prereq');

/** Build the prereq spec + run the way the engine does — from the manifest step. */
async function makePrereqRun(runner: ProcessRunner) {
  const spec = await buildCommandSpec(new CommandBuilder(fakeShell), '/repo', prereqStep.command);
  return createPrereqRun({ runner, spec, parse: streamResultParser(prereqStep.parser) });
}

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
  const prereq = await makePrereqRun(runner);

  assert.equal(prereq.spec.command, 'bash');
  assert.ok(prereq.spec.args[0]?.endsWith('check-prerequisites.sh'));

  prereq.run(() => {});
  const report = await prereq.result;
  assert.equal(report.ready, true);
  assert.equal(report.summary.requiredPassed, 3);
});

test('exit code 1 (missing requirements) still yields a parsed, not-ready report', async () => {
  const runner = new FakeRunner(await fixture('prereq-with-failures.txt'), 1);
  const prereq = await makePrereqRun(runner);

  prereq.run(() => {});
  const report = await prereq.result;
  assert.equal(report.ready, false);
  assert.equal(report.exitCode, 1);
});
