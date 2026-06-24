import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapLighthouse, mapVisualReport, pairDesignResults } from '../../../src/core/qa/discover';

// NOTE: building the `pnpm run <script>` QA spec is now manifest-driven and covered in
// tests/core/product/command-spec.test.mts (qa steps). This file keeps QA artifact
// discovery/mapping, which is generic engine.

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
