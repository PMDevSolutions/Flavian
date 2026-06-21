import { promises as fs } from 'node:fs';
import { join } from 'node:path';

/** List the theme slugs available in <repoRoot>/themes (the dev themes mounted into the container). */
export async function listThemeDirs(repoRoot: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(join(repoRoot, 'themes'), { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}
