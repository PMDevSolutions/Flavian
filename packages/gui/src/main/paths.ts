import { join } from 'node:path';

/** Absolute path to the repo's scripts/ directory for a given project root. */
export function getScriptsDir(repoRoot: string): string {
  return join(repoRoot, 'scripts');
}

/** Absolute path to wordpress-local.sh for a given project root (used in later sub-issues). */
export function getWordpressLocalScript(repoRoot: string): string {
  return join(repoRoot, 'wordpress-local.sh');
}
