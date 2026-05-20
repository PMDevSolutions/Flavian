import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.zip', '.gz',
]);

const TOKEN_RE = /\{\{([A-Z_]+)\}\}/g;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export async function substituteTokens(rootDir, tokens) {
  const files = await walk(rootDir);
  for (const file of files) {
    if (BINARY_EXTS.has(extname(file).toLowerCase())) continue;
    const raw = await readFile(file, 'utf8');
    if (!raw.includes('{{')) continue;
    const replaced = raw.replace(TOKEN_RE, (full, key) => {
      if (!(key in tokens)) {
        throw new Error(`Unknown token {{${key}}} in ${file}`);
      }
      return tokens[key];
    });
    if (replaced !== raw) await writeFile(file, replaced);
  }
}
