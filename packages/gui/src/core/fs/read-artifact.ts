import { promises as fs } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

/** Repo-relative directories the renderer is allowed to read QA artifacts from. */
const ALLOWED_DIRS = ['tests/visual', '.claude/visual-qa', '.lighthouseci'];

/**
 * Resolve a renderer-supplied relative path safely under repoRoot: it must stay
 * within the repo, sit under an allowlisted artifact directory, and match the
 * allowed extension. Returns the absolute path or null if it fails any check.
 */
function safeResolve(repoRoot: string, relPath: string, allowedExt: RegExp): string | null {
  const target = resolve(repoRoot, relPath);
  const rel = relative(repoRoot, target).replace(/\\/g, '/');
  if (rel === '' || rel.startsWith('../') || isAbsolute(rel)) return null;
  if (!ALLOWED_DIRS.some((dir) => rel === dir || rel.startsWith(`${dir}/`))) return null;
  if (!allowedExt.test(rel)) return null;
  return target;
}

/** Read a PNG artifact as a data URL (for <img>), or null if missing/disallowed. */
export async function readImageDataUrl(repoRoot: string, relPath: string): Promise<string | null> {
  const target = safeResolve(repoRoot, relPath, /\.png$/i);
  if (!target) return null;
  try {
    const buf = await fs.readFile(target);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Read a text artifact (markdown/json/txt), or null if missing/disallowed. */
export async function readTextArtifact(repoRoot: string, relPath: string): Promise<string | null> {
  const target = safeResolve(repoRoot, relPath, /\.(md|json|txt)$/i);
  if (!target) return null;
  try {
    return await fs.readFile(target, 'utf8');
  } catch {
    return null;
  }
}
