import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapLighthouse, mapVisualReport, pairDesignResults } from '../../../src/core/qa/discover';
import { isQaScript, qaCommandSpec } from '../../../src/core/qa/qa-commands';
import { CommandBuilder } from '../../../src/core/shell/command-builder';
import type { ShellResolver } from '../../../src/core/shell/shell-resolver';

const fakeShell: ShellResolver = {
  resolveBash: async () => 'bash',
  resolveTool: async () => null,
};

test('mapVisualReport reconstructs image paths from file names', () => {
  const report = mapVisualReport({
    totalFiles: 1,
    passed: 0,
    failed: 1,
    skipped: 0,
    overallPass: false,
    results: [{ file: 'home-desktop-1440px.png', status: 'FAIL', mismatchPct: 0.02, pass: false }],
  });
  assert.equal(report.failed, 1);
  const r = report.results[0];
  assert.equal(r.actualRel, 'tests/visual/actual/home-desktop-1440px.png');
  assert.equal(r.baselineRel, 'tests/visual/baselines/home-desktop-1440px.png');
  assert.equal(r.diffRel, 'tests/visual/diffs/diff-home-desktop-1440px.png');
});

test('mapLighthouse summarizes pass/fail and collects failures', () => {
  const summary = mapLighthouse([
    { url: 'http://x/', auditId: 'perf', passed: true },
    { url: 'http://x/', auditId: 'a11y', passed: false, expected: 0.9, actual: 0.8 },
  ]);
  assert.equal(summary.total, 2);
  assert.equal(summary.passed, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.failures[0].auditId, 'a11y');
  assert.equal(summary.failures[0].expected, '0.9');
});

test('qaCommandSpec runs a pnpm script via `bash -c`', async () => {
  const spec = await qaCommandSpec(new CommandBuilder(fakeShell), '/repo', 'visual:diff');
  assert.equal(spec.command, 'bash');
  assert.deepEqual(spec.args, ['-c', 'pnpm run visual:diff']);
});

test('pairDesignResults pairs design shots with desktop results by page stem', () => {
  const pairs = pairDesignResults(
    ['home.png', 'about.png'],
    ['home-desktop-1440px.png', 'home-mobile-375px.png'],
  );
  assert.equal(pairs.length, 2);
  const home = pairs.find((p) => p.name === 'home');
  assert.equal(home?.designRel, '.claude/visual-qa/screenshots/figma/home.png');
  assert.equal(
    home?.resultRel,
    '.claude/visual-qa/screenshots/wordpress/chromium/home-desktop-1440px.png',
  );
  const about = pairs.find((p) => p.name === 'about');
  assert.equal(about?.resultRel, undefined); // no matching result render
});

test('isQaScript validates the script set', () => {
  assert.ok(isQaScript('visual:diff'));
  assert.ok(isQaScript('lighthouse:run'));
  assert.ok(!isQaScript('rm -rf'));
});
