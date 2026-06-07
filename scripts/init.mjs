import { parseArgs } from 'node:util';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename } from 'node:path';
import { resolveDefaults } from './init/default-resolver.mjs';
import { apply } from './init/apply.mjs';

const exec = promisify(execFile);

function usage() {
  console.log(`Usage: node scripts/init.mjs [options]

Options:
  --yes                 Non-interactive mode (uses defaults / flag values)
  --name <slug>         Project slug
  --theme <starter>     blank | flavian-shop | figma | indesign
  --woo                 Enable WooCommerce
  --multisite           Configure a WordPress multisite network
  --multisite-mode <m>  subdirectory | subdomain (default subdirectory)
  --port <n>            Local dev port (default 8080)
  --email <addr>        Admin email
  --no-git              Skip git init
  --help                Show this message
`);
}

async function getGitEmail() {
  try {
    const { stdout } = await exec('git', ['config', 'user.email']);
    return stdout.trim() || null;
  } catch { return null; }
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        yes:    { type: 'boolean' },
        name:   { type: 'string' },
        theme:  { type: 'string' },
        woo:    { type: 'boolean' },
        multisite: { type: 'boolean' },
        'multisite-mode': { type: 'string' },
        port:   { type: 'string' },
        email:  { type: 'string' },
        'no-git': { type: 'boolean' },
        help:   { type: 'boolean' },
      },
      strict: true,
    });
  } catch (err) {
    console.error(`Error: ${err.message}`);
    usage();
    process.exit(2);
  }

  if (parsed.values.help) { usage(); process.exit(0); }

  const flagPort = parsed.values.port != null ? Number(parsed.values.port) : undefined;
  if (parsed.values.port != null && (!Number.isInteger(flagPort) || flagPort < 1024 || flagPort > 65535)) {
    console.error('Error: --port must be an integer 1024–65535');
    process.exit(2);
  }

  if (parsed.values['multisite-mode'] != null && !parsed.values.multisite) {
    console.error('Error: --multisite-mode requires --multisite');
    process.exit(2);
  }

  const targetDir = process.cwd();
  const env = { cwdBasename: basename(targetDir), gitEmail: await getGitEmail() };

  let config;
  if (parsed.values.yes) {
    try {
      config = resolveDefaults({
        name: parsed.values.name,
        theme: parsed.values.theme,
        woo: parsed.values.woo,
        multisite: parsed.values.multisite,
        multisiteMode: parsed.values['multisite-mode'],
        port: flagPort,
        email: parsed.values.email,
        noGit: parsed.values['no-git'],
      }, env);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(2);
    }
  } else {
    const { runPrompts } = await import('./init/prompts.mjs');
    config = await runPrompts(env);
    if (parsed.values['no-git']) config.initGit = false;
  }

  try {
    await apply(targetDir, config);
  } catch (err) {
    console.error(`\n✗ Setup failed: ${err.message}`);
    process.exit(1);
  }

  const multisiteSteps = config.multisite ? `
Multisite (${config.multisiteMode}) is configured in .env. To build the network:
  ./wordpress-local.sh install   # runs wp core multisite-install in ${config.multisiteMode} mode
  open http://localhost:${config.port}/wp-admin/network/${config.multisiteMode === 'subdomain' ? `
  ⚠ subdomain mode needs wildcard DNS for *.localhost — see docs/multisite/README.md` : ''}
` : '';

  console.log(`
✓ Project ready at ${targetDir}

Next steps:
  cd ${basename(targetDir)}
  cp .env.example .env       # already done — review values
  docker compose up -d        # boot WordPress at http://localhost:${config.port}
  open http://localhost:${config.port}/wp-admin
${multisiteSteps}
Resources:
  - Theme:   themes/${config.projectName}/
  - Docs:    CLAUDE.md, docs/QUICK-START.md, docs/CLI-WIZARD.md
  - Skills:  .claude/skills/README.md
`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
