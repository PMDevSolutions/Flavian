import { app } from 'electron';
import type { ProductManifest } from '../shared/product/manifest';
import type { ProjectRef } from '../shared/types/project';
import { locateRepoRoot, validateRepoRoot } from '../core/project/locate-root';
import { loadSettings } from './settings';

/**
 * Resolve the project to open at startup for the active product:
 *   1. the last-used project saved in settings (the installed-app path), if still valid;
 *   2. otherwise locate the repo by walking up from the app path (dev: packages/gui)
 *      and then the launch cwd.
 *
 * Detection criteria (markers, package name) come from the manifest, so this stays
 * generic. If none validate, an invalid ProjectRef is returned and the renderer shows
 * the "Open a <product> project" gate. The GUI always operates on a real, writable
 * project directory on disk — never the read-only app bundle.
 */
export async function resolveInitialProject(manifest: ProductManifest): Promise<ProjectRef> {
  const { project } = manifest;
  const { projectRoot } = await loadSettings();
  if (projectRoot) {
    const saved = await validateRepoRoot(projectRoot, project);
    if (saved.valid) return saved;
  }
  const fromAppPath = await locateRepoRoot(app.getAppPath(), project);
  if (fromAppPath.valid) return fromAppPath;
  return locateRepoRoot(process.cwd(), project);
}
