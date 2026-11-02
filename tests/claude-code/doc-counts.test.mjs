// Tests for scripts/check-doc-counts.sh: the on-disk agent and skill counts
// must match every "N agents" / "N skills" claim in the live documentation.
//
// Run: node --test tests/claude-code/doc-counts.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = join(REPO_ROOT, 'scripts', 'check-doc-counts.sh');

function run(args, cwd = REPO_ROOT) {
  const res = spawnSync('bash', [SCRIPT, ...args], { cwd, encoding: 'utf8', timeout: 60000 });
  return { code: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'doc-counts-'));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  }
  return root;
}

const agent = (n) => `---\nname: ${n}\ndescription: ${n}\n---\n`;
const BASE = {
  '.claude/agents/one.md': agent('one'),
  '.claude/agents/two.md': agent('two'),
  '.claude/skills/neat/SKILL.md': '---\nname: neat\ndescription: d\n---\n',
  '.claude/skills/empty-dir/notes.md': 'not a skill\n',
};

function countAgents() {
  return readdirSync(join(REPO_ROOT, '.claude', 'agents')).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md').length;
}
function countSkills() {
  const dir = join(REPO_ROOT, '.claude', 'skills');
  return readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory() && existsSync(join(dir, n, 'SKILL.md'))).length;
}

describe('check-doc-counts.sh', () => {
  test('--help exits 0 and shows usage', () => {
    const r = run(['--help']);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /Usage:/);
    assert.match(r.stdout, /--json/);
  });

  test('an unknown flag exits 2', () => {
    assert.equal(run(['--bogus']).code, 2);
  });

  test('--json on this repository reports the on-disk counts and no drift', () => {
    const r = run(['--json']);
    const j = JSON.parse(r.stdout);
    assert.equal(j.agents, countAgents());
    assert.equal(j.skills, countSkills());
    assert.deepEqual(j.violations, [], JSON.stringify(j.violations, null, 2));
    assert.equal(j.drift, 0);
    assert.equal(r.code, 0);
  });

  test('ignores historical directories and the changelog', () => {
    const root = fixture({
      ...BASE,
      'docs/plans/2026-01-01-old.md': 'Back then the repo had 9 agents and 9 skills.\n',
      'docs/audits/2026-01-01-audit.md': 'Audited 9 agents.\n',
      'archive/notes.md': 'An old copy with 9 specialized agents.\n',
      'CHANGELOG.md': '## 1.0.0\n- shipped 9 agents\n',
      'README.md': 'This template ships 2 agents and 1 skills.\n',
    });
    try {
      const r = run(['--json', '--root', root]);
      const j = JSON.parse(r.stdout);
      assert.equal(j.agents, 2);
      assert.equal(j.skills, 1);
      assert.equal(j.drift, 0, JSON.stringify(j.violations));
      assert.equal(r.code, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('reports a claim that disagrees with the disk, in all three claim forms', () => {
    const root = fixture({
      ...BASE,
      'README.md': 'This template ships 5 custom agents.\n',
      'docs/guide.md': '## Skills (3 Total)\n\n**Total Agents:** 2\n',
    });
    try {
      const r = run(['--json', '--root', root]);
      const j = JSON.parse(r.stdout);
      assert.equal(j.drift, 2, JSON.stringify(j.violations));
      assert.ok(j.violations.some((v) => v.startsWith('README.md:1:') && v.includes('claims 5 agents, expected 2')));
      assert.ok(j.violations.some((v) => v.startsWith('docs/guide.md:1:') && v.includes('claims 3 skills, expected 1')));
      assert.equal(r.code, 1);
      const human = run(['--root', root]);
      assert.equal(human.code, 1);
      assert.match(human.stdout, /README\.md:1/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('does not read a singular noun or a number next to an unrelated word as a claim', () => {
    const root = fixture({
      ...BASE,
      'docs/guide.md': 'Phase 4 agent setup. 7 of the agents carry hooks. 3 scripts per agent.\n',
    });
    try {
      const j = JSON.parse(run(['--json', '--root', root]).stdout);
      assert.equal(j.drift, 0, JSON.stringify(j.violations));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
