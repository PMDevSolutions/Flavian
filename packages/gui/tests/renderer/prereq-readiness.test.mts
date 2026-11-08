import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readinessSummary } from '../../src/renderer/components/prereq-readiness';
import type { PrereqItem } from '../../src/shared/types/prerequisites';

// The Prerequisites screen's banner used to open with "Ready to use this template: NO", the
// first thing a new user read when a check failed (issue #191). The banner now says what
// is wrong and which check to fix; these tests pin that copy.

const item = (label: string, status: PrereqItem['status'], group: PrereqItem['group']): PrereqItem => ({
  group,
  status,
  label,
  detail: '',
  hints: [],
});

test('a ready report gets the all-clear and names the product', () => {
  const summary = readinessSummary({ ready: true, items: [item('Git', 'pass', 'required-software')] }, 'Flavian');
  assert.deepEqual(summary, {
    tone: 'ok',
    title: 'All checks passed. This machine is ready for Flavian.',
    detail: null,
  });
});

test('one failing required tool is named in the banner', () => {
  const items = [item('Git', 'pass', 'required-software'), item('Docker', 'fail', 'required-software')];
  const summary = readinessSummary({ ready: false, items }, 'Flavian');
  assert.equal(summary.tone, 'warn');
  assert.equal(summary.title, 'Not ready yet: 1 check needs attention');
  assert.equal(summary.detail, 'Docker. Follow the guidance below, then re-check.');
});

test('several failing checks are counted and listed in the order the script reported them', () => {
  const items = [
    item('Docker', 'fail', 'required-software'),
    item('GitHub account', 'fail', 'required-accounts'),
    item('Free disk space', 'fail', 'system-requirements'),
  ];
  const summary = readinessSummary({ ready: false, items }, 'Flavian');
  assert.equal(summary.title, 'Not ready yet: 3 checks need attention');
  assert.equal(
    summary.detail,
    'Docker, GitHub account, Free disk space. Follow the guidance below, then re-check.',
  );
});

test('optional software that is missing does not count as something to fix', () => {
  const items = [item('Git', 'pass', 'required-software'), item('WP-CLI', 'fail', 'optional-software')];
  assert.equal(readinessSummary({ ready: true, items }, 'Flavian').tone, 'ok');
  const notReady = readinessSummary({ ready: false, items }, 'Flavian');
  assert.equal(notReady.title, 'Not ready yet: the check did not complete');
  assert.equal(notReady.detail, 'See the raw output below, then re-check.');
});

test('a report that is not ready but shows no failing check points at the raw output', () => {
  const summary = readinessSummary({ ready: false, items: [] }, 'Flavian');
  assert.equal(summary.tone, 'warn');
  assert.equal(summary.title, 'Not ready yet: the check did not complete');
  assert.equal(summary.detail, 'See the raw output below, then re-check.');
});
