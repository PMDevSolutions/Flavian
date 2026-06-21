import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAsyncRun } from '../../../src/core/process/async-run';
import type { ProcessEvent } from '../../../src/core/process/runner-types';

test('a resolving operation emits stdout lines and exits 0', async () => {
  const events: ProcessEvent[] = [];
  const handle = makeAsyncRun(async (emit) => {
    emit('step 1');
    emit('step 2');
  })((e) => events.push(e));

  const result = await handle.done;
  assert.equal(result.code, 0);

  const out = events.flatMap((e) => (e.type === 'stdout' ? [e.chunk] : [])).join('');
  assert.match(out, /step 1/);
  assert.match(out, /step 2/);
  assert.ok(events.some((e) => e.type === 'exit' && e.code === 0));
});

test('a throwing operation emits an error event and exits 1', async () => {
  const events: ProcessEvent[] = [];
  const handle = makeAsyncRun(async () => {
    throw new Error('boom');
  })((e) => events.push(e));

  const result = await handle.done;
  assert.equal(result.code, 1);
  assert.ok(events.some((e) => e.type === 'error' && /boom/.test(e.message)));
  assert.ok(events.some((e) => e.type === 'exit' && e.code === 1));
});
