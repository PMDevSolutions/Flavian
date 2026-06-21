import { app } from 'electron';
import type { ProjectRef } from '../shared/types/project';
import { locateRepoRoot } from '../core/project/locate-root';

/**
 * Resolve the Flavian project root the GUI operates on.
 * - Dev: walk up from the app path (packages/gui), then cwd, to find the markers.
 * - Packaged: scripts are carried as extraResources at process.resourcesPath.
 */
export async function resolveProjectRef(): Promise<ProjectRef> {
  if (app.isPackaged) {
    return { root: process.resourcesPath, valid: true };
  }
  const fromAppPath = await locateRepoRoot(app.getAppPath());
  if (fromAppPath.valid) return fromAppPath;
  return locateRepoRoot(process.cwd());
}
