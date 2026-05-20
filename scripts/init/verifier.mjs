import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function pathExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function checkJson(file) {
  const raw = await readFile(file, 'utf8');
  JSON.parse(raw);
}

export async function verify(targetDir, config) {
  const failures = [];
  const themeDir = join(targetDir, 'themes', config.projectName);
  const skipsTheme = config.themeStarter === 'figma' || config.themeStarter === 'indesign';

  const checks = [];

  checks.push({
    name: '.env present',
    run: async () => {
      if (!await pathExists(join(targetDir, '.env'))) {
        throw new Error('Run the wizard again — .env was not written');
      }
      const raw = await readFile(join(targetDir, '.env'), 'utf8');
      if (raw.trim() === '') throw new Error('.env is empty');
    },
  });

  if (!skipsTheme) {
    checks.push(
      {
        name: 'theme.json is valid JSON',
        run: () => checkJson(join(themeDir, 'theme.json')),
      },
      {
        name: 'theme has style.css',
        run: async () => {
          if (!await pathExists(join(themeDir, 'style.css'))) {
            throw new Error('Missing themes/<slug>/style.css');
          }
        },
      },
      {
        name: 'theme has templates/index.html',
        run: async () => {
          if (!await pathExists(join(themeDir, 'templates/index.html'))) {
            throw new Error('Missing themes/<slug>/templates/index.html');
          }
        },
      },
    );
  }

  for (const check of checks) {
    try { await check.run(); }
    catch (err) { failures.push({ check: check.name, reason: err.message }); }
  }

  return { ok: failures.length === 0, failures };
}
