import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, access, readFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

async function stageFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'init-smoke-'));
  for (const item of ['.env.example', '.claude', 'themes', 'scripts', 'package.json']) {
    await cp(join(REPO_ROOT, item), join(dir, item), { recursive: true });
  }
  return dir;
}

test('blank theme — full --yes run produces a verifiable scaffold', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const { stdout } = await exec('node', ['scripts/init.mjs', '--yes', '--no-git',
    '--name=smoke-blank', '--theme=blank', '--port=8090'], { cwd: dir });

  assert.match(stdout, /✓ \.env/);
  assert.match(stdout, /✓ theme/);

  await access(join(dir, 'themes/smoke-blank/style.css'), constants.F_OK);
  const env = await readFile(join(dir, '.env'), 'utf8');
  assert.match(env, /WP_PORT=8090/);
  assert.match(env, /WP_SITE_TITLE=Smoke Blank/);
});

test('flavian-shop theme — copies shop and rewrites headers', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await exec('node', ['scripts/init.mjs', '--yes', '--no-git',
    '--name=smoke-shop', '--theme=flavian-shop'], { cwd: dir });

  const style = await readFile(join(dir, 'themes/smoke-shop/style.css'), 'utf8');
  assert.match(style, /Theme Name: Smoke Shop/);
  assert.match(style, /Text Domain: smoke-shop/);
});

test('multisite — --yes --multisite --name=my-network produces a multisite .env', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const { stdout } = await exec('node', ['scripts/init.mjs', '--yes', '--no-git',
    '--multisite', '--name=my-network', '--theme=blank'], { cwd: dir });

  assert.match(stdout, /Multisite \(subdirectory\) is configured/);

  const env = await readFile(join(dir, '.env'), 'utf8');
  assert.match(env, /WP_MULTISITE=true/);
  assert.match(env, /WP_MULTISITE_MODE=subdirectory/);
  assert.match(env, /MS_NETWORK_TITLE=My Network/);

  // The theme is still scaffolded alongside the multisite config.
  await access(join(dir, 'themes/my-network/style.css'), constants.F_OK);
});

test('multisite — subdomain mode writes .env and warns about wildcard DNS', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const { stdout } = await exec('node', ['scripts/init.mjs', '--yes', '--no-git', '--multisite',
    '--multisite-mode=subdomain', '--name=net-sub', '--theme=blank'], { cwd: dir });

  const env = await readFile(join(dir, '.env'), 'utf8');
  assert.match(env, /WP_MULTISITE_MODE=subdomain/);
  assert.match(stdout, /wildcard DNS for \*\.localhost/);
});

test('multisite — --multisite-mode without --multisite is rejected (exit 2)', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await assert.rejects(
    () => exec('node', ['scripts/init.mjs', '--yes', '--no-git',
      '--multisite-mode=subdomain', '--name=x'], { cwd: dir }),
    { code: 2 }
  );
});

test('multisite — an unknown --multisite-mode value exits cleanly (exit 2)', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await assert.rejects(
    () => exec('node', ['scripts/init.mjs', '--yes', '--no-git',
      '--multisite', '--multisite-mode=sideways', '--name=x'], { cwd: dir }),
    (err) => err.code === 2 && /multisite mode/i.test(err.stderr)
  );
});

test('figma placeholder — writes NEXT-STEPS.md, no theme dir', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await exec('node', ['scripts/init.mjs', '--yes', '--no-git',
    '--name=smoke-figma', '--theme=figma'], { cwd: dir });

  const next = await readFile(join(dir, 'docs/NEXT-STEPS.md'), 'utf8');
  assert.match(next, /figma-to-fse-autonomous-workflow/);
  await assert.rejects(() => access(join(dir, 'themes/smoke-figma'), constants.F_OK));
});

test('canva — --yes --canva --canva-export produces a working theme', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const fixture = join(REPO_ROOT, 'tests/fixtures/canva/landing');
  const { stdout } = await exec('node', ['scripts/init.mjs', '--yes', '--no-git',
    '--canva', `--canva-export=${fixture}`, '--name=smoke-canva', '--port=8099'], { cwd: dir });

  // The static verifier ran and passed (valid theme.json, style.css, index.html).
  assert.match(stdout, /✓ theme/);
  assert.match(stdout, /✓ verify/);

  // theme.json carries Canva-extracted tokens.
  const themeJson = JSON.parse(await readFile(join(dir, 'themes/smoke-canva/theme.json'), 'utf8'));
  assert.ok(themeJson.settings.color.palette.some(c => c.color === '#1f6feb'));

  // Content lives in a pattern referenced by front-page.html (pattern-first).
  const front = await readFile(join(dir, 'themes/smoke-canva/templates/front-page.html'), 'utf8');
  assert.match(front, /wp:pattern \{"slug":"smoke-canva\/canva-content"\}/);
  const pattern = await readFile(join(dir, 'themes/smoke-canva/patterns/canva-content.php'), 'utf8');
  assert.match(pattern, /Welcome to Acme/);
  await access(join(dir, 'themes/smoke-canva/assets/images/hero.jpg'), constants.F_OK);
});

test('canva — --canva without --canva-export exits 2', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await assert.rejects(
    () => exec('node', ['scripts/init.mjs', '--yes', '--no-git', '--canva', '--name=x'], { cwd: dir }),
    (err) => err.code === 2 && /export path/i.test(err.stderr)
  );
});

test('canva — --canva-export without --canva exits 2', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await assert.rejects(
    () => exec('node', ['scripts/init.mjs', '--yes', '--no-git',
      '--canva-export=./somewhere', '--theme=blank', '--name=x'], { cwd: dir }),
    (err) => err.code === 2 && /requires --canva/i.test(err.stderr)
  );
});

test('a leading "--" separator (as pnpm forwards it) is tolerated', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  // pnpm on some platforms passes the `--` through to the script literally.
  const { stdout } = await exec('node', ['scripts/init.mjs', '--', '--yes', '--no-git',
    '--name=dash-sep', '--theme=blank'], { cwd: dir });
  assert.match(stdout, /✓ verify/);
  await access(join(dir, 'themes/dash-sep/style.css'), constants.F_OK);
});

test('--yes refuses an existing themes/<slug> dir cleanly', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await cp(join(REPO_ROOT, 'themes/flavian-shop'), join(dir, 'themes/dup-site'), { recursive: true });

  await assert.rejects(
    () => exec('node', ['scripts/init.mjs', '--yes', '--no-git',
      '--name=dup-site', '--theme=blank'], { cwd: dir }),
    { code: 1 }
  );
});
