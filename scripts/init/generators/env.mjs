import { readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

export async function writeEnv(targetDir, config) {
  const examplePath = join(targetDir, '.env.example');
  try {
    await access(examplePath, constants.R_OK);
  } catch {
    throw new Error(`.env.example not found in ${targetDir}`);
  }

  const lines = (await readFile(examplePath, 'utf8')).split(/\r?\n/);
  const overrides = {
    WORDPRESS_DB_NAME: config.projectName,
    WP_ADMIN_EMAIL: config.adminEmail,
    WP_SITE_TITLE: config.siteTitle,
    WP_PORT: String(config.port),
    WC_DEFAULT_THEME: config.projectName,
  };

  const seen = new Set();
  const out = lines.map(line => {
    const m = /^([A-Z_]+)=/.exec(line);
    if (!m) return line;
    seen.add(m[1]);
    return overrides[m[1]] != null ? `${m[1]}=${overrides[m[1]]}` : line;
  });

  for (const [key, value] of Object.entries(overrides)) {
    if (!seen.has(key)) out.push(`${key}=${value}`);
  }

  await writeFile(join(targetDir, '.env'), out.join('\n') + '\n');
}
