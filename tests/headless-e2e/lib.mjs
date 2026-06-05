// Helpers for the headless WordPress smoke test.
//
// Two execution surfaces (mirrors tests/canva-e2e/lib.mjs):
//   - Host shell (bash) for the deterministic scaffold-frontend.sh check.
//   - The running Docker WordPress stack (`docker compose exec ... wp`) for the
//     API / CORS / hardening checks, plus host-side `fetch` against :8080.
//
// Everything is best-effort about the environment: callers use wpReachable() to
// decide whether the Docker-dependent suite can run, and skip cleanly otherwise.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repo root (two levels up from tests/headless-e2e/). */
export const ROOT = resolve(__dirname, '..', '..');

/** Host-reachable WordPress origin (Docker maps container :80 → host :8080). */
export const BASE_URL = process.env.HEADLESS_E2E_BASE_URL ?? 'http://localhost:8080';

/** Origin the mu-plugin is configured to allow (set in the test's before()). */
export const FRONTEND_ORIGIN = process.env.HEADLESS_E2E_FRONTEND_ORIGIN ?? 'http://localhost:3000';

/** Run a host command, returning trimmed stdout. Throws on non-zero exit. */
export function run(cmd, args, opts = {}) {
	return execFileSync(cmd, args, {
		cwd: ROOT,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		...opts,
	}).trim();
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

/**
 * Fetch with a short timeout so a hung container fails the test instead of
 * hanging CI. Returns the Response (caller inspects status/headers/body).
 */
export async function httpGet(path, { origin, method = 'GET' } = {}) {
	const headers = {};
	if (origin) headers.Origin = origin;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 15_000);
	try {
		return await fetch(BASE_URL + path, { method, headers, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

/** POST a GraphQL query to /graphql. Returns the Response. */
export async function graphql(query, variables = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 15_000);
	try {
		return await fetch(BASE_URL + '/graphql', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: FRONTEND_ORIGIN },
			body: JSON.stringify({ query, variables }),
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timer);
	}
}
