// Tests for the hooks in .claude/hooks/.
//
// Contract (https://code.claude.com/docs/en/hooks): Claude Code passes the
// event as JSON on stdin; a hook replies with JSON on stdout (or nothing,
// or plain text for SessionStart) and ALWAYS exits 0. These tests feed
// synthetic events and parse the reply.
//
// Run: node --test tests/claude-code/hooks.test.mjs
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, statSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HOOKS_DIR = join(REPO_ROOT, '.claude', 'hooks');

const temps = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), 'flavian-hooks-'));
  temps.push(dir);
  return dir;
}

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Hook Test',
  GIT_AUTHOR_EMAIL: 'hooks@example.com',
  GIT_COMMITTER_NAME: 'Hook Test',
  GIT_COMMITTER_EMAIL: 'hooks@example.com',
};

function git(dir, ...args) {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...GIT_ENV },
  });
}

function write(dir, rel, content) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), content);
}

/** A git repo with the Flavian layout: root-level themes/, a flavian CLI, one theme. */
function flavianRepo() {
  const dir = tmp();
  git(dir, 'init', '-q', '-b', 'main');
  write(dir, 'bin/flavian.mjs', '// flavian cli\n');
  write(dir, 'package.json', JSON.stringify({ name: 'flavian', version: '0.0.0' }));
  write(dir, 'themes/demo/style.css', '/*\nTheme Name: Demo\n*/\n');
  write(dir, 'themes/demo/theme.json', '{"version":3}\n');
  write(dir, 'themes/demo/templates/index.html', '<!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph -->\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

/** A repo that tracks its theme under wp-content/, the way a client site does. */
function wpContentRepo() {
  const dir = tmp();
  git(dir, 'init', '-q', '-b', 'main');
  write(dir, 'wp-content/themes/site/style.css', '/*\nTheme Name: Site\n*/\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

function runHook(name, event, { cwd = REPO_ROOT, projectDir = cwd, args = [] } = {}) {
  const input = typeof event === 'string' ? event : JSON.stringify({ cwd, ...event });
  const res = spawnSync('bash', [join(HOOKS_DIR, name), ...args], {
    cwd,
    encoding: 'utf8',
    input,
    timeout: 20000,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
  assert.equal(res.status, 0, `${name} exited ${res.status}: ${res.stderr}`);
  return res.stdout;
}

const parse = (out) => (out.trim() ? JSON.parse(out) : null);
const decision = (out) => parse(out)?.hookSpecificOutput?.permissionDecision;
const reason = (out) => parse(out)?.hookSpecificOutput?.permissionDecisionReason ?? '';
const context = (out) => parse(out)?.hookSpecificOutput?.additionalContext ?? '';

const pre = (command, extra = {}) => ({
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command },
  permission_mode: 'default',
  ...extra,
});
const writeEvent = (file_path, tool_name = 'Write') => ({
  hook_event_name: 'PreToolUse',
  tool_name,
  tool_input: { file_path, content: '' },
  permission_mode: 'default',
});
const post = (command, stdout, stderr = '') => ({
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command },
  tool_response: { stdout, stderr, interrupted: false, isImage: false },
});
const SUBAGENT = { agent_id: 'a1b2c3', agent_type: 'deployment-agent' };

const HOOKS = [
  'validate-theme-location.sh',
  'deploy-guard.sh',
  'agent-no-deploy.sh',
  'pre-commit-token-guard.sh',
  'bundle-size-guard.sh',
  'post-bash-reminders.sh',
  'session-context.sh',
  'figma-fse-post-template.sh',
  'figma-fse-completion.sh',
];

describe('hook contract', () => {
  for (const hook of HOOKS) {
    test(`${hook} exits 0 and stays quiet or returns JSON on an unrelated event`, () => {
      const dir = tmp();
      const out = runHook(hook, pre('ls -la'), { cwd: dir });
      if (out.trim() && hook !== 'session-context.sh') assert.doesNotThrow(() => JSON.parse(out));
    });

    test(`${hook} exits 0 on empty stdin`, () => {
      const dir = tmp();
      assert.equal(typeof runHook(hook, '', { cwd: dir }), 'string');
    });

    test(`${hook} exits 0 on malformed JSON`, () => {
      const dir = tmp();
      assert.equal(typeof runHook(hook, '{not json', { cwd: dir }), 'string');
    });

    test(`${hook} is executable, keeps the defensive skeleton, and reads stdin`, () => {
      const file = join(HOOKS_DIR, hook);
      assert.notEqual(statSync(file).mode & 0o111, 0, `${hook} is not executable`);
      const text = readFileSync(file, 'utf8');
      assert.match(text, /trap 'exit 0' ERR/);
      assert.doesNotMatch(text, /TOOL_INPUT="\$\{1/);
      assert.doesNotMatch(text, /CLAUDE_TOOL_INPUT/);
    });
  }
});

describe('validate-theme-location (PreToolUse Write|Edit)', () => {
  test('denies a write under wp-content/themes/ and names the root-level path', () => {
    const dir = flavianRepo();
    const out = runHook('validate-theme-location.sh', writeEvent('wp-content/themes/acme/style.css'), { cwd: dir });
    assert.equal(decision(out), 'deny');
    assert.match(reason(out), /themes\/acme\/style\.css/);
    assert.match(reason(out), /wp-content/);
  });

  test('denies an absolute path under wp-content/plugins/ and corrects it', () => {
    const dir = flavianRepo();
    const out = runHook('validate-theme-location.sh', writeEvent(`${dir}/wp-content/plugins/acme/acme.php`, 'Edit'), { cwd: dir });
    assert.equal(decision(out), 'deny');
    assert.match(reason(out), new RegExp(`${dir}/plugins/acme/acme\\.php`));
  });

  test('allows root-level themes/, plugins/ and unrelated paths', () => {
    const dir = flavianRepo();
    for (const p of ['themes/acme/style.css', 'plugins/acme/acme.php', 'mu-plugins/x.php', 'docs/notes.md']) {
      assert.equal(runHook('validate-theme-location.sh', writeEvent(p), { cwd: dir }).trim(), '', p);
    }
  });

  test('allows wp-content paths in a repo that tracks wp-content (plugin install elsewhere)', () => {
    const dir = wpContentRepo();
    const out = runHook('validate-theme-location.sh', writeEvent('wp-content/themes/site/functions.php'), { cwd: dir });
    assert.equal(out.trim(), '');
  });

  test('stays silent when the event carries no file path', () => {
    const dir = flavianRepo();
    assert.equal(runHook('validate-theme-location.sh', pre('ls'), { cwd: dir }).trim(), '');
  });
});

describe('deploy-guard (PreToolUse Bash)', () => {
  const ASK = [
    './scripts/remote-deployment/deploy.sh --env production',
    'bash scripts/remote-deployment/deploy.sh --env production --auto-rollback',
    'bash scripts/remote-deployment/rollback.sh --env staging',
    './scripts/remote-deployment/rollback.sh --env production --to rel-20261102',
    'wp --ssh=deploy@example.com plugin update --all',
    'rsync -az themes/ deploy@example.com:/var/www/html/wp-content/themes/',
    'scp -r themes/demo deploy@example.com:/var/www/',
    "ssh deploy@example.com 'cd /var/www && wp cache flush'",
    'docker compose down -v',
    'docker compose --profile woocommerce down --volumes',
    'docker volume rm flavian_db_data',
    'docker system prune -af',
    'wp db reset --yes',
    'docker compose exec wordpress wp db reset --yes --allow-root',
  ];
  const SILENT = [
    './scripts/remote-deployment/deploy.sh --env production --dry-run',
    'bash scripts/remote-deployment/rollback.sh --env production --list',
    "ssh deploy@example.com 'wp plugin list'",
    'ssh deploy@example.com "tail -n 50 /var/log/nginx/error.log"',
    'rsync -az deploy@example.com:/var/www/uploads/ ./backup/',
    'docker compose up -d wordpress db',
    'docker compose down',
    'docker compose ps',
    'git commit -m "deploy notes for production"',
    'wp db export backup.sql',
    './scripts/remote-deployment/pre-deploy-checks.sh --target all',
    'ls -la',
  ];

  test('asks a human before production deploys, rollbacks, remote writes and local data loss', () => {
    const dir = flavianRepo();
    for (const cmd of ASK) {
      const out = runHook('deploy-guard.sh', pre(cmd), { cwd: dir });
      assert.equal(decision(out), 'ask', cmd);
      assert.match(reason(out), /^Deploy guard:/, cmd);
    }
  });

  test('stays silent on dry runs, listings, read-only remote commands and ordinary work', () => {
    const dir = flavianRepo();
    for (const cmd of SILENT) {
      assert.equal(runHook('deploy-guard.sh', pre(cmd), { cwd: dir }).trim(), '', cmd);
    }
  });

  test('reminds, without a decision, on a non-production deploy', () => {
    const dir = flavianRepo();
    const out = runHook('deploy-guard.sh', pre('./scripts/remote-deployment/deploy.sh --env staging'), { cwd: dir });
    assert.equal(decision(out), undefined);
    assert.match(context(out), /staging/);
    assert.match(context(out), /--dry-run/);
  });

  test('denies every gated tier inside a subagent', () => {
    const dir = flavianRepo();
    for (const cmd of ['./scripts/remote-deployment/deploy.sh --env production', 'docker compose down -v', 'rsync -az themes/ deploy@example.com:/var/www/']) {
      const out = runHook('deploy-guard.sh', pre(cmd, SUBAGENT), { cwd: dir });
      assert.equal(decision(out), 'deny', cmd);
      assert.match(reason(out), /^Deploy guard \(subagent\)/, cmd);
    }
  });

  test('agent-no-deploy.sh is the subagent form of the guard', () => {
    const dir = flavianRepo();
    const out = runHook('agent-no-deploy.sh', pre('./scripts/remote-deployment/deploy.sh --env production'), { cwd: dir });
    assert.equal(decision(out), 'deny');
    assert.match(reason(out), /subagent/);
    assert.equal(runHook('agent-no-deploy.sh', pre('docker compose up -d'), { cwd: dir }).trim(), '');
  });

  test('ignores commands that only mention a gated command in a commit message or heredoc body', () => {
    const dir = flavianRepo();
    for (const cmd of [
      'git commit -m "docs: how to use ssh and docker compose down -v on the stack"',
      "cat > docs/notes.md <<'EOF'\nssh deploy@example.com 'wp cache flush'\ndocker compose down -v\n./scripts/remote-deployment/deploy.sh --env production\nEOF",
      'perl -pi -e "s/foo/ssh deploy@example.com/" docs/notes.md',
    ]) {
      assert.equal(runHook('deploy-guard.sh', pre(cmd), { cwd: dir }).trim(), '', cmd);
    }
  });

  test('still asks for a gated command that follows a heredoc', () => {
    const dir = flavianRepo();
    const cmd = "cat > notes.txt <<'EOF'\nhello\nEOF\nssh deploy@example.com 'wp cache flush'";
    assert.equal(decision(runHook('deploy-guard.sh', pre(cmd), { cwd: dir })), 'ask');
  });

  test('turns ask into deny where a hook cannot prompt', () => {
    const dir = flavianRepo();
    for (const mode of ['bypassPermissions', 'dontAsk']) {
      const out = runHook('deploy-guard.sh', pre('./scripts/remote-deployment/deploy.sh --env production', { permission_mode: mode }), { cwd: dir });
      assert.equal(decision(out), 'deny', mode);
      assert.match(reason(out), new RegExp(mode));
    }
  });
});

describe('pre-commit-token-guard (PreToolUse Bash, git commit)', () => {
  test('asks on a hex color in a staged pattern and lists the file', () => {
    const dir = flavianRepo();
    write(dir, 'themes/demo/patterns/hero.php', '<?php\n?>\n<!-- wp:group -->\n<div style="color:#ff0000;padding:24px">Hero</div>\n<!-- /wp:group -->\n');
    git(dir, 'add', 'themes/demo/patterns/hero.php');
    const out = runHook('pre-commit-token-guard.sh', pre('git commit -m "add hero"'), { cwd: dir });
    assert.equal(decision(out), 'ask');
    assert.match(reason(out), /^Token guard:/);
    assert.match(reason(out), /hero\.php/);
    assert.match(reason(out), /#ff0000/);
  });

  test('ignores an inline SVG fill and a clean pattern', () => {
    const dir = flavianRepo();
    write(dir, 'themes/demo/patterns/icon.php', '<!-- wp:html --><svg viewBox="0 0 10 10"><path fill="#fff" d="M0 0h10v10H0z"/></svg><!-- /wp:html -->\n');
    write(dir, 'themes/demo/patterns/clean.php', '<!-- wp:paragraph {"textColor":"primary","fontSize":"large"} --><p class="has-primary-color">Hi</p><!-- /wp:paragraph -->\n');
    git(dir, 'add', 'themes/demo/patterns');
    assert.equal(runHook('pre-commit-token-guard.sh', pre('git commit -m "icons"'), { cwd: dir }).trim(), '');
  });

  test('ignores a violation the commit does not carry, but sees it with commit -a', () => {
    const dir = flavianRepo();
    write(dir, 'themes/demo/parts/header.html', '<!-- wp:group --><div>Header</div><!-- /wp:group -->\n');
    git(dir, 'add', 'themes/demo/parts/header.html');
    git(dir, 'commit', '-q', '-m', 'header');
    write(dir, 'themes/demo/parts/header.html', '<!-- wp:group --><div style="background:#123456">Header</div><!-- /wp:group -->\n');
    assert.equal(runHook('pre-commit-token-guard.sh', pre('git commit -m "nothing staged"'), { cwd: dir }).trim(), '');
    assert.equal(decision(runHook('pre-commit-token-guard.sh', pre('git commit -am "all"'), { cwd: dir })), 'ask');
  });

  test('stays silent on commands other than git commit', () => {
    const dir = flavianRepo();
    write(dir, 'themes/demo/patterns/hero.php', '<div style="color:#ff0000">x</div>\n');
    git(dir, 'add', 'themes/demo/patterns/hero.php');
    assert.equal(runHook('pre-commit-token-guard.sh', pre('git status'), { cwd: dir }).trim(), '');
  });
});

describe('bundle-size-guard (PreToolUse Bash, git commit)', () => {
  test('reminds when a theme with staged changes is over 5120 KB', () => {
    const dir = flavianRepo();
    write(dir, 'themes/big/style.css', '/*\nTheme Name: Big\n*/\n');
    writeFileSync(join(dir, 'themes/big/blob.bin'), Buffer.alloc(6 * 1024 * 1024, 1));
    git(dir, 'add', 'themes/big');
    const out = runHook('bundle-size-guard.sh', pre('git commit -m "big theme"'), { cwd: dir });
    assert.equal(decision(out), undefined);
    assert.match(context(out), /\[bundle-guard\]/);
    assert.match(context(out), /themes\/big/);
    assert.match(context(out), /5120/);
  });

  test('reminds when a plugin with staged changes is over 10240 KB', () => {
    const dir = flavianRepo();
    write(dir, 'plugins/huge/huge.php', '<?php // Plugin Name: Huge\n');
    writeFileSync(join(dir, 'plugins/huge/blob.bin'), Buffer.alloc(11 * 1024 * 1024, 1));
    git(dir, 'add', 'plugins/huge');
    const out = runHook('bundle-size-guard.sh', pre('git commit -m "huge plugin"'), { cwd: dir });
    assert.match(context(out), /plugins\/huge/);
    assert.match(context(out), /10240/);
  });

  test('stays silent for a small theme and for other commands', () => {
    const dir = flavianRepo();
    write(dir, 'themes/demo/templates/page.html', '<!-- wp:post-content /-->\n');
    git(dir, 'add', 'themes/demo');
    assert.equal(runHook('bundle-size-guard.sh', pre('git commit -m "page"'), { cwd: dir }).trim(), '');
    assert.equal(runHook('bundle-size-guard.sh', pre('git status'), { cwd: dir }).trim(), '');
  });
});

describe('post-bash-reminders (PostToolUse Bash)', () => {
  const run = (kase, event) => runHook('post-bash-reminders.sh', event, { args: [kase] });

  test('build-qa: a passing standards check earns the full quality-gate reminder', () => {
    const out = run('build-qa', post('./scripts/wordpress/check-coding-standards.sh themes/demo', '✓ All files pass WordPress coding standards'));
    assert.match(context(out), /\[post-build-qa\]/);
    assert.match(context(out), /security-scan\.sh/);
    assert.equal(run('build-qa', post('./scripts/wordpress/check-coding-standards.sh themes/demo', '3 errors found')).trim(), '');
    assert.equal(run('build-qa', post('ls -la', 'pass')).trim(), '');
    assert.equal(run('build-qa', post('tests/bats/bin/bats tests/figma-fse/validate-theme-location.bats', 'ok 17 pass')).trim(), '');
    assert.match(context(run('build-qa', post('./scripts/validate-theme.sh themes/demo', 'Validation passed'))), /\[post-build-qa\]/);
  });

  test('coverage: a phpunit run that printed coverage points at the 80% target', () => {
    const out = run('coverage', post('vendor/bin/phpunit --coverage-text', 'Code Coverage Report:\n  Lines: 72.00% (36/50)'));
    assert.match(context(out), /\[coverage-check\]/);
    assert.match(context(out), /80%/);
    assert.equal(run('coverage', post('vendor/bin/phpunit', 'OK (5 tests, 9 assertions)')).trim(), '');
  });

  test('dark-mode: a passing visual diff suggests the dark-mode check', () => {
    assert.match(context(run('dark-mode', post('node scripts/visual-diff.js a.png b.png', 'PASS: 0.10% mismatch'))), /check-dark-mode\.sh/);
    assert.equal(run('dark-mode', post('node scripts/visual-diff.js a.png b.png', 'FAIL: 4.2% mismatch\nPASS: other')).trim(), '');
  });

  test('mutation: an all-green phpunit or pest run suggests Infection', () => {
    assert.match(context(run('mutation', post('vendor/bin/phpunit', 'OK (12 tests, 30 assertions)'))), /infection/);
    assert.match(context(run('mutation', post('vendor/bin/pest', '  Tests:  12 passed (30 assertions)'))), /infection/);
    assert.equal(run('mutation', post('vendor/bin/phpunit', 'FAILURES!\nTests: 12, Assertions: 30, Failures: 1.')).trim(), '');
  });

  test('reads a string tool_response as well as an object', () => {
    const event = { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'vendor/bin/phpunit' }, tool_response: 'OK (3 tests, 3 assertions)' };
    assert.match(context(run('mutation', event)), /infection/);
  });

  test('stays silent without a known case name', () => {
    assert.equal(runHook('post-bash-reminders.sh', post('vendor/bin/phpunit', 'OK (3 tests)')).trim(), '');
    assert.equal(runHook('post-bash-reminders.sh', post('vendor/bin/phpunit', 'OK (3 tests)'), { args: ['nonsense'] }).trim(), '');
  });
});

describe('session-context (SessionStart)', () => {
  const start = { hook_event_name: 'SessionStart', source: 'startup' };

  test('stays silent outside a Flavian checkout', () => {
    const dir = tmp();
    git(dir, 'init', '-q', '-b', 'main');
    assert.equal(runHook('session-context.sh', start, { cwd: dir }).trim(), '');
  });

  test('prints a status block naming the themes in a Flavian checkout', () => {
    const dir = flavianRepo();
    const out = runHook('session-context.sh', start, { cwd: dir });
    assert.match(out, /^Flavian status/);
    assert.match(out, /themes\//);
    assert.match(out, /demo/);
    assert.match(out, /main/);
  });

  test('reports a pipeline run in flight from the state file', () => {
    const dir = flavianRepo();
    write(dir, '.claude/pipeline/acme/state.json', JSON.stringify({
      pipeline: 'figma-to-fse',
      theme: 'acme',
      phase: '2.4',
      updatedAt: '2026-11-02T10:42:00Z',
      templates: [
        { name: 'header.html', kind: 'part', status: 'done' },
        { name: 'index.html', kind: 'template', status: 'pending' },
      ],
    }));
    const out = runHook('session-context.sh', start, { cwd: dir });
    assert.match(out, /acme/);
    assert.match(out, /1\/2/);
    assert.match(out, /2\.4/);
  });

  test('warns when files are tracked under wp-content/', () => {
    const dir = flavianRepo();
    write(dir, 'wp-content/themes/stray/style.css', '');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'stray');
    assert.match(runHook('session-context.sh', start, { cwd: dir }), /wp-content/);
  });
});

describe('registration', () => {
  const settings = JSON.parse(readFileSync(join(REPO_ROOT, '.claude', 'settings.json'), 'utf8'));
  const plugin = JSON.parse(readFileSync(join(HOOKS_DIR, 'hooks.json'), 'utf8'));

  function handlers(hooks) {
    const out = [];
    for (const [event, groups] of Object.entries(hooks)) {
      for (const group of groups) {
        for (const h of group.hooks) {
          const m = String(h.command).match(/\.claude\/hooks\/([\w.-]+\.sh)"?((?:\s+[\w-]+)*)/);
          out.push({ event, matcher: group.matcher ?? '', if: h.if ?? '', script: m ? m[1] : h.command, args: m ? m[2].trim() : '', onFailure: h.onFailure ?? '' });
        }
      }
    }
    return out.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }

  test('settings.json and hooks.json register the same hooks', () => {
    assert.deepEqual(handlers(settings.hooks), handlers(plugin.hooks));
  });

  test('every registered script exists and is referenced through the right variable', () => {
    for (const [file, hooks, variable] of [[join(REPO_ROOT, '.claude', 'settings.json'), settings.hooks, '"$CLAUDE_PROJECT_DIR"'], [join(HOOKS_DIR, 'hooks.json'), plugin.hooks, '${CLAUDE_PLUGIN_ROOT}']]) {
      for (const h of handlers(hooks)) assert.ok(existsSync(join(HOOKS_DIR, h.script)), `${basename(file)} references missing ${h.script}`);
      for (const groups of Object.values(hooks)) for (const g of groups) for (const h of g.hooks) {
        assert.ok(String(h.command).includes(variable), `${basename(file)}: ${h.command}`);
        assert.doesNotMatch(String(h.command), /TOOL_INPUT|TOOL_OUTPUT/);
      }
    }
  });

  test('the deploy guard fails closed and the location guard covers Write, Edit and NotebookEdit', () => {
    const pre = handlers(settings.hooks).filter((h) => h.event === 'PreToolUse');
    const guard = pre.find((h) => h.script === 'deploy-guard.sh');
    assert.equal(guard?.onFailure, 'block');
    const location = pre.find((h) => h.script === 'validate-theme-location.sh');
    assert.equal(location?.matcher, 'Write|Edit|NotebookEdit');
    for (const kase of ['build-qa', 'coverage', 'dark-mode', 'mutation']) {
      assert.ok(handlers(settings.hooks).some((h) => h.script === 'post-bash-reminders.sh' && h.args === kase && h.if), kase);
    }
  });

  test('agent frontmatter hooks reference scripts that exist', () => {
    const agentsDir = join(REPO_ROOT, '.claude', 'agents');
    for (const f of readdirSync(agentsDir).filter((n) => n.endsWith('.md'))) {
      const text = readFileSync(join(agentsDir, f), 'utf8');
      const fm = text.split('\n---')[0];
      for (const m of fm.matchAll(/command:\s*"?(?:bash\s+)?(?:"\$CLAUDE_PROJECT_DIR"\/|\.\/)?([\w./-]+\.sh)/g)) {
        assert.ok(existsSync(join(REPO_ROOT, m[1])), `${f} references missing ${m[1]}`);
      }
    }
  });
});
