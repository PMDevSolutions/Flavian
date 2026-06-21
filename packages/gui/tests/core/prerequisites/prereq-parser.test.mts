import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePrereqOutput } from '../../../src/core/prerequisites/prereq-parser';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): Promise<string> =>
  readFile(join(here, '..', '..', 'fixtures', name), 'utf8');

test('all-pass fixture → ready, groups, versions, summary', async () => {
  const report = parsePrereqOutput(await fixture('prereq-all-pass.txt'), 0);

  assert.equal(report.ready, true);
  assert.deepEqual(report.summary, {
    requiredPassed: 3,
    requiredTotal: 3,
    optionalInstalled: 5,
    optionalTotal: 5,
    systemPassed: 3,
    systemTotal: 3,
  });

  const git = report.items.find((i) => i.key === 'git');
  assert.ok(git, 'git item present');
  assert.equal(git?.status, 'pass');
  assert.equal(git?.group, 'required-software');
  assert.equal(git?.version, '2.43.0');
  assert.equal(git?.minVersion, '2.30.0');

  assert.ok(!report.items.some((i) => i.status === 'fail'), 'no failures');
  // The trailing "1. 2. 3." footer must NOT have leaked into the last item's hints.
  const os = report.items.find((i) => i.key === 'os');
  assert.ok(!os?.hints.some((h) => /Start WordPress/.test(h)), 'footer steps must not be hints');
});

test('with-failures fixture → docker fails with guidance + hints, not ready', async () => {
  const report = parsePrereqOutput(await fixture('prereq-with-failures.txt'), 1);

  assert.equal(report.ready, false);
  const docker = report.items.find((i) => i.key === 'docker');
  assert.ok(docker, 'docker item present');
  assert.equal(docker?.status, 'fail');
  assert.ok(docker?.guidance, 'failure should carry curated guidance');
  assert.match(docker?.guidance?.url ?? '', /docker\.com/);
  assert.ok(docker?.hints.some((h) => /docs\.docker\.com/.test(h)), 'install hint attached');
  assert.equal(report.summary.requiredPassed, 2);
});

test('with-skips fixture → optional skips and summary counts', async () => {
  const report = parsePrereqOutput(await fixture('prereq-with-skips.txt'), 0);

  assert.equal(report.ready, true);
  const wp = report.items.find((i) => i.key === 'wp');
  assert.equal(wp?.status, 'skip');
  assert.equal(wp?.group, 'optional-software');
  assert.equal(report.summary.optionalInstalled, 0);
  assert.equal(report.summary.optionalTotal, 5);
});

test('strips ANSI color codes before parsing', () => {
  const raw = '\x1b[0;32m[PASS]\x1b[0m Git \x1b[0;36m2.43.0\x1b[0m (minimum: 2.30.0)';
  const report = parsePrereqOutput(raw, 0);

  const git = report.items.find((i) => i.key === 'git');
  assert.ok(git, 'git parsed from ANSI-laden line');
  assert.equal(git?.status, 'pass');
  assert.equal(git?.version, '2.43.0');
  assert.ok(!report.raw.includes('\x1b'), 'raw output has ANSI stripped');
});
