// Helpers for the Canva-to-WordPress integration test.
//
// Two execution surfaces:
//   - Host shell (bash) for the deterministic canva-fse helper scripts.
//   - The running Docker WordPress stack (`docker compose exec ... wp`) for the
//     deploy / activate / no-fatal checks. Mirrors tests/visual/seed.sh.
//
// Everything is best-effort about the environment: callers use wpReachable() to
// decide whether the Docker-dependent suite can run, and skip cleanly otherwise.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repo root (two levels up from tests/canva-e2e/). */
export const ROOT = resolve(__dirname, '..', '..');

export const BASE_URL = process.env.CANVA_E2E_BASE_URL ?? 'http://localhost:8080';
export const THEME_SLUG = 'canva-fixture';
export const FIXTURE_DIR = resolve(ROOT, 'tests/fixtures/canva/landing');
export const EXPECTED_THEME = resolve(FIXTURE_DIR, 'expected-theme');
/** Theme path inside the wordpress container (= bind-mounted host themes/<slug>). */
export const CONTAINER_THEME_PATH = `/var/www/html/wp-content/themes/${THEME_SLUG}`;
/** Host-side view of the same files (read-only — see deployTheme for why). */
export const DEPLOY_DIR = resolve(ROOT, 'themes', THEME_SLUG);

/** Run a host command, returning trimmed stdout. Throws on non-zero exit. */
export function run(cmd, args, opts = {}) {
	return execFileSync(cmd, args, {
		cwd: ROOT,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		...opts,
	}).trim();
}

/** Run one of the canva-fse helper scripts via bash; returns stdout. */
export function runScript(relPath, args = []) {
	return run('bash', [relPath, ...args]);
}

/** Run `wp <args> --allow-root` inside the wordpress container. */
export function wp(args, opts = {}) {
	return run(
		'docker',
		['compose', 'exec', '-T', 'wordpress', 'wp', ...args, '--allow-root'],
		opts,
	);
}

/** Run an arbitrary command inside the wordpress container's web root. */
export function dockerExec(shellCmd, opts = {}) {
	return run('docker', ['compose', 'exec', '-T', 'wordpress', 'sh', '-lc', shellCmd], opts);
}

/**
 * Deploy the golden theme into the container.
 *
 * We copy *through Docker* rather than writing the bind-mounted host themes/
 * directory directly: when WordPress boots it writes default themes into that
 * mount as container-root, which flips the host dir to root ownership and makes
 * a host-side mkdir fail (EACCES) on Linux CI runners. `docker compose cp` runs
 * as the daemon, sidestepping host ownership entirely, and works the same on
 * Linux and Docker Desktop.
 */
export function deployTheme() {
	dockerExec(`rm -rf ${CONTAINER_THEME_PATH} && mkdir -p ${CONTAINER_THEME_PATH}`);
	run('docker', ['compose', 'cp', `${EXPECTED_THEME}/.`, `wordpress:${CONTAINER_THEME_PATH}`]);
}

/** Remove the deployed theme from the container (best-effort). */
export function removeTheme() {
	try {
		dockerExec(`rm -rf ${CONTAINER_THEME_PATH}`);
	} catch {
		/* best-effort */
	}
}

/**
 * True if the Docker WordPress stack is up and core is installed.
 * Never throws — returns false on any error so the suite can skip cleanly.
 */
export function wpReachable() {
	try {
		wp(['core', 'is-installed']);
		return true;
	} catch {
		return false;
	}
}
