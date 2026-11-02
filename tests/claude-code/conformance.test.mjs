// Tests for scripts/claude-code-conformance.js (ported from the Maecenas
// vitest suite to node:test). Fixture projects are built in temp directories.
//
// Run: node --test tests/claude-code/conformance.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = join(REPO_ROOT, 'scripts', 'claude-code-conformance.js');

function run(root) {
  const res = spawnSync('node', [SCRIPT, '--root', root, '--json'], { encoding: 'utf8' });
  assert.ok(res.stdout.trim(), `no JSON output (status ${res.status}): ${res.stderr}`);
  return { code: res.status, result: JSON.parse(res.stdout) };
}

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'cc-conformance-'));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  }
  return root;
}

const messages = (r) => r.result.findings.map((f) => `${f.severity}:${f.file}:${f.message}`);
const withFixture = (files, fn) => {
  const root = fixture(files);
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
};

describe('claude-code-conformance', () => {
  test('passes on this repository', () => {
    const r = run(REPO_ROOT);
    assert.equal(r.result.errors, 0, JSON.stringify(r.result.findings.filter((f) => f.severity === 'error'), null, 2));
    assert.equal(r.code, 0);
    const agents = readdirSync(join(REPO_ROOT, '.claude', 'agents')).filter((f) => f.endsWith('.md')).length;
    const skills = readdirSync(join(REPO_ROOT, '.claude', 'skills')).filter((d) => existsSync(join(REPO_ROOT, '.claude', 'skills', d, 'SKILL.md'))).length;
    assert.equal(r.result.agents, agents);
    assert.equal(r.result.skills, skills);
  });

  test('flags retired tools, invalid colors, and subagent-unavailable tools on agents', () => {
    withFixture({
      '.claude/agents/writer.md': '---\nname: writer\ndescription: Writes things\ntools: Read, MultiEdit, Task, AskUserQuestion, TodoWrite\ncolor: gold\n---\nBody\n',
    }, (root) => {
      const r = run(root);
      assert.equal(r.code, 1);
      const m = messages(r);
      assert.ok(m.some((x) => x.includes('"MultiEdit" is retired')));
      assert.ok(m.some((x) => x.includes('"Task" is retired')));
      assert.ok(m.some((x) => x.includes('"AskUserQuestion" is never available inside a subagent')));
      assert.ok(m.some((x) => x.includes('color: "gold"')));
      assert.ok(m.some((x) => x.startsWith('warning') && x.includes('TodoWrite')));
    });
  });

  test('flags name/filename mismatches, unknown fields, and dangling skill references', () => {
    withFixture({
      '.claude/agents/alpha.md': '---\nname: beta\ndescription: d\ntools: Read\nfoo: bar\nskills:\n  - nope\n---\nBody\n',
    }, (root) => {
      const m = messages(run(root));
      assert.ok(m.some((x) => x.includes('name "beta" does not match')));
      assert.ok(m.some((x) => x.includes('unknown field "foo"')));
      assert.ok(m.some((x) => x.includes('skills: "nope" is not a skill')));
    });
  });

  test('flags globs on skills, legacy command files, and shadowed commands', () => {
    withFixture({
      '.claude/skills/thing/SKILL.md': '---\nname: thing\ndescription: d\nglobs:\n  - "src/**"\n---\nBody\n',
      '.claude/commands/thing.md': '---\ndescription: old\n---\nBody\n',
      '.claude/commands/other.md': '---\ndescription: old\n---\nBody\n',
    }, (root) => {
      const r = run(root);
      const m = messages(r);
      assert.ok(m.some((x) => x.includes('"globs" is not a field')));
      assert.ok(m.some((x) => x.includes('shadowed: a skill named "thing"')));
      assert.ok(m.some((x) => x.includes('legacy custom command')));
      assert.equal(r.code, 1);
    });
  });

  test('flags hooks that use the retired $TOOL_INPUT contract or missing scripts', () => {
    withFixture({
      '.claude/settings.json': JSON.stringify({
        hooks: {
          PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'bash .claude/hooks/old.sh "$TOOL_INPUT" "$TOOL_OUTPUT"' }] }],
          BogusEvent: [{ hooks: [{ type: 'command', command: 'true' }] }],
        },
      }),
      '.claude/hooks/old.sh': '#!/usr/bin/env bash\nset -u\ntrap \'exit 0\' ERR\nTOOL_INPUT="${1:-}"\necho hi\n',
    }, (root) => {
      const m = messages(run(root));
      assert.ok(m.some((x) => x.includes('"$TOOL_INPUT" is not part of the hook contract')));
      assert.ok(m.some((x) => x.includes('unknown event "BogusEvent"')));
      assert.ok(m.some((x) => x.includes('reads TOOL_INPUT/TOOL_OUTPUT from positional args')));
    });
  });

  test('accepts onFailure on a hook handler and range-checks autoCompactWindow', () => {
    withFixture({
      '.claude/settings.json': JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/guard.sh', timeout: 10, onFailure: 'block' }] }] } }),
      '.claude/hooks/guard.sh': "#!/usr/bin/env bash\nset -u\ntrap 'exit 0' ERR\ncat >/dev/null\n",
      '.claude/agents/fine.md': '---\nname: fine\ndescription: Fine agent\nautoCompactWindow: 150000\n---\nBody\n',
      '.claude/agents/tiny.md': '---\nname: tiny\ndescription: Tiny window\nautoCompactWindow: 5000\n---\nBody\n',
    }, (root) => {
      const m = messages(run(root));
      assert.ok(!m.some((x) => x.includes('handler field "onFailure"')));
      assert.ok(m.some((x) => x.includes('tiny.md') && x.includes('autoCompactWindow')));
      assert.ok(!m.some((x) => x.includes('fine.md')));
    });
  });

  test('leaves dated audit records and retirement notes out of the retired-tool scan', () => {
    withFixture({
      'docs/audits/2026-10-03-audit.md': '| 1 | Agents listed `MultiEdit` | fixed |\n',
      'docs/guide.md': '| `TaskStop` | Stop a background task (replaces `KillShell`) |\n| `Edit` | Edit files; the old `MultiEdit` is gone |\n',
    }, (root) => {
      assert.equal(run(root).result.warnings, 0);
    });
  });

  test('skips dangling symlinks instead of crashing', () => {
    const root = fixture({ 'docs/guide.md': 'Use the `MultiEdit` tool here.\n' });
    try {
      mkdirSync(join(root, '.auth', 'profile'), { recursive: true });
      symlinkSync(join(root, 'missing-target'), join(root, '.auth', 'profile', 'SingletonLock'));
      symlinkSync(join(root, 'missing-dir'), join(root, '.claude-skill-link'));
      const r = run(root);
      assert.equal(r.code, 0);
      assert.ok(messages(r).some((x) => x.includes('docs/guide.md') && x.includes('"MultiEdit"')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('leaves gitignored directories out of the live-docs scan in a git repo', () => {
    withFixture({
      '.gitignore': 'tmp/\n',
      'tmp/scratch.md': 'Use the `MultiEdit` tool here.\n',
      'docs/guide.md': 'Use the `MultiEdit` tool here.\n',
    }, (root) => {
      execFileSync('git', ['init', '-q'], { cwd: root });
      const m = messages(run(root));
      assert.ok(m.some((x) => x.includes('docs/guide.md')));
      assert.ok(!m.some((x) => x.includes('tmp/scratch.md')));
    });
  });

  test('lets metadata.excludedAgents keep an agent out of the plugin, and only those', () => {
    const agent = (n) => `---\nname: ${n}\ndescription: ${n} agent\n---\nBody\n`;
    const manifest = (agents, excluded) => JSON.stringify({ name: 'demo', agents: agents.map((a) => `./.claude/agents/${a}.md`), metadata: { excludedAgents: excluded } });
    const files = { '.claude/agents/keep.md': agent('keep'), '.claude/agents/skip.md': agent('skip'), '.claude/agents/other.md': agent('other') };
    withFixture({ ...files, '.claude-plugin/plugin.json': manifest(['keep', 'other'], ['skip']) }, (root) => assert.equal(run(root).result.errors, 0));
    withFixture({ ...files, '.claude-plugin/plugin.json': manifest(['keep', 'other', 'skip'], ['skip']) }, (root) => assert.ok(messages(run(root)).some((x) => x.includes('metadata.excludedAgents keeps out of the plugin'))));
    withFixture({ ...files, '.claude-plugin/plugin.json': manifest(['keep'], ['skip']) }, (root) => assert.ok(messages(run(root)).some((x) => x.includes('other.md is not listed'))));
  });

  test('accepts a clean minimal project', () => {
    withFixture({
      '.claude/agents/good.md': '---\nname: good\ndescription: Good agent\ntools: Read, Write, Edit, mcp__figma__*\nmodel: sonnet\ncolor: blue\nmemory: project\n---\nBody\n',
      '.claude/skills/neat/SKILL.md': '---\nname: neat\ndescription: Neat skill\nargument-hint: <x>\ncontext: fork\nagent: good\nbackground: false\n---\nBody\n',
      '.claude/rules/style.md': '---\npaths:\n  - "src/**"\n---\nRule\n',
    }, (root) => {
      const r = run(root);
      assert.equal(r.result.errors, 0);
      assert.equal(r.code, 0);
    });
  });

  test('the spec is stamped with the Claude Code version it was verified against', () => {
    const spec = JSON.parse(readFileSyncUtf8(join(REPO_ROOT, 'scripts', 'lib', 'claude-code-spec.json')));
    assert.match(spec.verifiedAgainst.claudeCodeVersion, /^2\.1\.\d+$/);
    assert.match(spec.verifiedAgainst.date, /^\d{4}-\d{2}-\d{2}$/);
  });
});

function readFileSyncUtf8(p) {
  return execFileSync('cat', [p], { encoding: 'utf8' });
}
