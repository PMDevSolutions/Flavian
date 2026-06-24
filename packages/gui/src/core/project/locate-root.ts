import { promises as fs } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import type { ProjectIdentity } from '../../shared/product/manifest';
import type { ProjectRef } from '../../shared/types/project';

/** Resolve a project-root-relative marker (declared with '/') to an absolute path. */
function markerPath(dir: string, marker: string): string {
  return join(dir, ...marker.split('/'));
}

/** Whether `dir` is a valid checkout of the given product (all markers + package name). */
async function isProductRoot(dir: string, project: ProjectIdentity): Promise<boolean> {
  for (const marker of project.markers) {
    try {
      await fs.access(markerPath(dir, marker));
    } catch {
      return false;
    }
  }
  try {
    const pkg = JSON.parse(await fs.readFile(join(dir, 'package.json'), 'utf8')) as { name?: string };
    if (pkg.name !== project.packageName) return false;
  } catch {
    return false;
  }
  return true;
}

/** Validate that a specific directory is a valid project root for the given product. */
export async function validateRepoRoot(dir: string, project: ProjectIdentity): Promise<ProjectRef> {
  if (await isProductRoot(dir, project)) return { root: dir, valid: true };
  return { root: dir, valid: false, reason: project.invalidReason };
}

/** Walk up from `startDir` to find the nearest project root for the given product. */
export async function locateRepoRoot(startDir: string, project: ProjectIdentity): Promise<ProjectRef> {
  const { root: fsRoot } = parse(startDir);
  let dir = startDir;
  for (let i = 0; i < 64; i += 1) {
    if (await isProductRoot(dir, project)) return { root: dir, valid: true };
    if (dir === fsRoot) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { root: startDir, valid: false, reason: project.notFoundReason };
}
