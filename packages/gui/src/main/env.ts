import { app } from 'electron';
import type { ProjectRef } from '../shared/types/project';
import { locateRepoRoot } from '../core/project/locate-root';

/**
 * Resolve the Flavian project the GUI operates on by locating the repo markers,
 * walking up from the app path (dev: packages/gui) and then the launch cwd.
 *
 * The GUI always works against a real, writable project directory on disk —
 * themes, .env, and conversion output are written there — so it never targets the
 * (read-only, asar-packed) app bundle. A future "Open project folder…" action
 * plugs in here, returning a user-chosen ProjectRef.
 */
export async function resolveProjectRef(): Promise<ProjectRef> {
  const fromAppPath = await locateRepoRoot(app.getAppPath());
  if (fromAppPath.valid) return fromAppPath;
  return locateRepoRoot(process.cwd());
}
