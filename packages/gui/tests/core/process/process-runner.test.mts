import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChildProcessRunner } from '../../../src/core/process/process-runner';
import type { ProcessEvent } from '../../../src/core/process/runner-types';

const NODE = process.execPath;

function collector(): { events: ProcessEvent[]; onEvent: (e: ProcessEvent) => void } {
  const events: ProcessEvent[] = [];
  return { events, onEvent: (e) => events.push(e) };
}

test('streams stdout and reports the exit code', async () => {
  const runner = new ChildProcessRunner();
  const { events, onEvent } = collector();
  const handle = runner.run(
    { command: NODE, args: ['-e', "process.stdout.write('hello\\n'); process.exit(3)"], cwd: process.cwd() },
    onEvent,
  );
  const result = await handle.done;

  assert.equal(result.code, 3);
  const stdout = events.flatMap((e) => (e.type === 'stdout' ? [e.chunk] : [])).join('');
  assert.match(stdout, /hello/);
  assert.ok(events.some((e) => e.type === 'spawn'), 'expected a spawn event');
  assert.ok(events.some((e) => e.type === 'exit'), 'expected an exit event');
});

test('emits an error event for a missing binary (ENOENT)', async () => {
  const runner = new ChildProcessRunner();
  const { events, onEvent } = collector();
  const handle = runner.run(
    { command: 'definitely-not-a-real-binary-xyz', args: [], cwd: process.cwd() },
    onEvent,
  );
  await handle.done;
  assert.ok(events.some((e) => e.type === 'error'), 'expected an error event');
});

test('cancel terminates a long-running process', async () => {
  const runner = new ChildProcessRunner();
  const { events, onEvent } = collector();
  const handle = runner.run(
    { command: NODE, args: ['-e', 'setInterval(() => {}, 1000)'], cwd: process.cwd() },
    onEvent,
  );
  await new Promise((r) => setTimeout(r, 200));
  handle.cancel();
  const result = await handle.done;

  assert.notEqual(result.code, 0); // killed → null (POSIX) or non-zero (Windows)
  assert.ok(events.some((e) => e.type === 'exit'), 'expected an exit event after cancel');
});
