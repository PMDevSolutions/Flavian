import { promises as fs } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import type { ProjectRef } from '../../shared/types/project';

/** Files that must all be present for a directory to be a Flavian project root. */
const MARKER_FILES = ['wordpress-local.sh', join('scripts', 'check-prerequisites.sh')];

async function isFlavianRoot(dir: string): Promise<boolean> {
  for (const marker of MARKER_FILES) {
    try {
      await fs.access(join(dir, marker));
    } catch {
      return false;
    }
  }
  try {
    const pkg = JSON.parse(await fs.readFile(join(dir, 'package.json'), 'utf8')) as { name?: string };
    if (pkg.name !== 'flavian') return false;
  } catch {
    return false;
  }
  return true;
}

/** Validate that a specific directory is a Flavian project root. */
export async function validateRepoRoot(dir: string): Promise<ProjectRef> {
  if (await isFlavianRoot(dir)) return { root: dir, valid: true };
  return {
    root: dir,
    valid: false,
    reason:
      'Not a Flavian project — expected wordpress-local.sh, scripts/check-prerequisites.sh, and a package.json named "flavian".',
  };
}

/** Walk up from `startDir` to find the nearest Flavian project root. */
export async function locateRepoRoot(startDir: string): Promise<ProjectRef> {
  const { root: fsRoot } = parse(startDir);
  let dir = startDir;
  for (let i = 0; i < 64; i += 1) {
    if (await isFlavianRoot(dir)) return { root: dir, valid: true };
    if (dir === fsRoot) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {
    root: startDir,
    valid: false,
    reason: 'No Flavian project found while walking up from the start directory.',
  };
}
