// Headless WordPress — smoke test (v2.0.0 milestone, issue #81).
//
// Part A (always runs): proves scaffold-frontend.sh emits a coherent Next.js
//   consumer from the committed template — no Docker required.
// Part B (needs the Docker WP stack): enables headless mode via wp-cli, then
//   asserts the contract the mu-plugin + installer promise:
//     - REST API responds
//     - CORS mirrors the configured frontend origin (and ONLY that origin)
//     - the users endpoint is hardened away
//     - WPGraphQL answers (skipped cleanly if the plugin isn't installed)
//     - no PHP fatals are logged while exercising any of it
//   Skipped with a clear message when the stack isn't reachable.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import {
	ROOT,
	BASE_URL,
	FRONTEND_ORIGIN,
	run,
	wp,
	dockerExec,
	wpReachable,
	httpGet,
	graphql,
} from './lib.mjs';

const SCAFFOLD_SLUG = 'headless-smoke';
const SCAFFOLD_DIR = resolve(ROOT, 'frontend', SCAFFOLD_SLUG);
const MU_PLUGIN = '/var/www/html/wp-content/mu-plugins/flavian-headless.php';

// ---------------------------------------------------------------------------
// Part A — scaffold-frontend.sh produces a coherent consumer (no Docker)
// ---------------------------------------------------------------------------

describe('scaffold-frontend.sh emits a working Next.js consumer', () => {
	before(() => {
		// Clean slate, then scaffold into frontend/<slug>/ (the only output dir
		// the script supports). Removed again in after().
		rmSync(SCAFFOLD_DIR, { recursive: true, force: true });
		run('bash', ['scripts/scaffold-frontend.sh', SCAFFOLD_SLUG, '--name', 'Headless Smoke', '--force']);
	});

	after(() => {
		rmSync(SCAFFOLD_DIR, { recursive: true, force: true });
	});

	test('writes the expected file tree', () => {
		const expected = [
			'package.json',
			'next.config.mjs',
			'.env.local.example',
			'src/lib/wp-client.ts',
			'src/lib/queries.ts',
			'src/app/page.tsx',
			'src/app/posts/[slug]/page.tsx',
			'src/app/api/preview/route.ts',
			'src/app/api/exit-preview/route.ts',
		];
		for (const rel of expected) {
			assert.ok(existsSync(resolve(SCAFFOLD_DIR, rel)), `missing scaffolded file: ${rel}`);
		}
	});

	test('package.json is valid JSON with the slug substituted', () => {
		const pkg = JSON.parse(readFileSync(resolve(SCAFFOLD_DIR, 'package.json'), 'utf8'));
		assert.equal(pkg.name, SCAFFOLD_SLUG, 'APP_SLUG token should be substituted into name');
		assert.ok(pkg.dependencies?.next, 'next should be a dependency');
	});

	test('.env.local.example documents the WP wiring the frontend needs', () => {
		const env = readFileSync(resolve(SCAFFOLD_DIR, '.env.local.example'), 'utf8');
		for (const key of ['WORDPRESS_URL', 'WORDPRESS_GRAPHQL_URL', 'WORDPRESS_PREVIEW_SECRET']) {
			assert.match(env, new RegExp(`^${key}=`, 'm'), `.env.local.example should declare ${key}`);
		}
	});

	test('no unsubstituted template tokens leak into the output', () => {
		const pkg = readFileSync(resolve(SCAFFOLD_DIR, 'package.json'), 'utf8');
		assert.doesNotMatch(pkg, /\{\{[A-Z_]+\}\}/, 'all {{TOKENS}} should be rendered');
	});
});

// ---------------------------------------------------------------------------
// Part B — headless contract against the live Docker WordPress stack
// ---------------------------------------------------------------------------

const reachable = wpReachable();

describe('headless WordPress exposes a hardened content API', {
	skip: reachable
		? false
		: `Docker WordPress stack not reachable at ${BASE_URL} — boot it with \`docker compose up -d wordpress db\` + install core to run the API checks`,
}, () => {
	before(() => {
		// Make the suite self-sufficient: turn headless mode on and point CORS at
		// FRONTEND_ORIGIN regardless of whether setup-headless.sh already ran.
		wp(['option', 'update', 'flavian_headless_mode', '1']);
		wp(['option', 'update', 'flavian_headless_frontend_url', FRONTEND_ORIGIN]);
		wp(['option', 'update', 'flavian_headless_preview_secret', 'smoke-secret-0123456789']);

		// Pretty permalinks are required for REST + WPGraphQL routes.
		wp(['option', 'update', 'permalink_structure', '/%postname%/']);
		wp(['rewrite', 'flush', '--hard']);

		// Capture PHP issues to a log instead of the response, then start clean.
		wp(['config', 'set', 'WP_DEBUG', 'true', '--raw']);
		wp(['config', 'set', 'WP_DEBUG_LOG', 'true', '--raw']);
		wp(['config', 'set', 'WP_DEBUG_DISPLAY', 'false', '--raw']);
		dockerExec('rm -f wp-content/debug.log');

		// A published post makes the REST collection non-trivial. Best-effort.
		try {
			wp(['post', 'create', '--post_title=Headless smoke post', '--post_status=publish', '--porcelain']);
		} catch {
			/* a seeded post is nice-to-have, not required */
		}
	});

	test('mu-plugin has no PHP syntax errors', () => {
		// `php -l` exits non-zero on a parse error, which throws here.
		dockerExec(`php -l ${MU_PLUGIN}`);
	});

	test('REST API returns the posts collection', async () => {
		const res = await httpGet('/wp-json/wp/v2/posts');
		assert.equal(res.status, 200, 'REST /wp/v2/posts should return HTTP 200');
		const body = await res.json();
		assert.ok(Array.isArray(body), 'posts endpoint should return a JSON array');
	});

	test('CORS mirrors the configured frontend origin', async () => {
		const res = await httpGet('/wp-json/', { origin: FRONTEND_ORIGIN });
		assert.equal(
			res.headers.get('access-control-allow-origin'),
			FRONTEND_ORIGIN,
			'allowed origin should be echoed back',
		);
		assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
		assert.match(res.headers.get('vary') ?? '', /Origin/i, 'Vary: Origin must be set for caches');
	});

	test('REST API does NOT grant credentialed CORS to an unconfigured origin', async () => {
		// WordPress core's default rest_send_cors_headers() reflects any origin
		// with credentials:true; restrict_rest_cors() in the mu-plugin replaces it.
		const res = await httpGet('/wp-json/', { origin: 'http://evil.example' });
		assert.notEqual(
			res.headers.get('access-control-allow-origin'),
			'http://evil.example',
			'an unallowed origin must never be reflected on the REST API',
		);
		assert.notEqual(
			res.headers.get('access-control-allow-credentials'),
			'true',
			'credentialed CORS must never be granted to an unallowed origin',
		);
	});

	test('CORS preflight (OPTIONS) short-circuits with 204', async () => {
		const res = await httpGet('/wp-json/', { origin: FRONTEND_ORIGIN, method: 'OPTIONS' });
		assert.equal(res.status, 204, 'preflight from an allowed origin should return 204');
	});

	test('users endpoint is hardened away (no author enumeration)', async () => {
		const res = await httpGet('/wp-json/wp/v2/users');
		assert.equal(res.status, 404, 'the /wp/v2/users route should be removed in headless mode');
	});

	test('WPGraphQL answers a query', async (t) => {
		const res = await graphql('{ generalSettings { title } }');
		if (res.status === 404) {
			t.skip('WPGraphQL not installed — run setup-headless.sh to enable the /graphql endpoint');
			return;
		}
		assert.equal(res.status, 200, 'GraphQL endpoint should return HTTP 200');
		const body = await res.json();
		assert.equal(typeof body?.data?.generalSettings?.title, 'string', 'expected generalSettings.title');
	});

	test('no PHP fatals or parse errors were logged while exercising the API', async () => {
		// Re-hit a couple of endpoints so any lazy hook fires before we read the log.
		await httpGet('/wp-json/wp/v2/posts', { origin: FRONTEND_ORIGIN });
		await httpGet('/');
		const log = dockerExec('test -f wp-content/debug.log && cat wp-content/debug.log || true');
		assert.doesNotMatch(log, /PHP (Fatal|Parse) error/i, `debug.log contains a fatal:\n${log}`);
	});
});
