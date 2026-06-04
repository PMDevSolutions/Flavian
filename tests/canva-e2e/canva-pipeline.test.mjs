// Canva-to-WordPress pipeline — integration test (v2.0.0 milestone).
//
// Part A (always runs): exercises the deterministic helper scripts the
//   canva-fse-converter agent path relies on, against the committed fixture.
// Part B (needs the Docker WP stack): deploys the golden theme — a representative
//   converter output — to WordPress, activates it, and proves it renders with no
//   PHP fatals. Skipped with a clear message when the stack isn't reachable.
//
// See tests/fixtures/canva/landing/README.md for why a golden theme stands in for
// the LLM agent's output.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
	BASE_URL,
	THEME_SLUG,
	FIXTURE_DIR,
	run,
	runScript,
	wp,
	dockerExec,
	deployTheme,
	removeTheme,
	wpReachable,
} from './lib.mjs';

const CSS = `${FIXTURE_DIR}/style.css`;
const HTML = `${FIXTURE_DIR}/index.html`;

// ---------------------------------------------------------------------------
// Part A — deterministic helper scripts (no Docker required)
// ---------------------------------------------------------------------------

describe('canva-fse helper scripts (deterministic agent-path pieces)', () => {
	test('parse-canva-export.sh extracts a complete token set from the fixture CSS', () => {
		const json = runScript('scripts/canva-fse/parse-canva-export.sh', ['--theme-json', CSS]);
		const theme = JSON.parse(json); // throws if the script emits invalid JSON

		const { color, typography, spacing } = theme.settings;
		assert.ok(color.palette.length >= 3, 'expected colors (hex + rgb) extracted');
		assert.ok(typography.fontFamilies.length >= 2, 'expected font families extracted');
		assert.ok(typography.fontSizes.length >= 3, 'expected font sizes extracted');
		assert.ok(spacing.spacingSizes.length >= 3, 'expected spacing tokens extracted');
	});

	test('convert-html-to-blocks.sh produces balanced, expected block markup', () => {
		const blocks = runScript('scripts/canva-fse/convert-html-to-blocks.sh', [HTML]);

		for (const type of ['heading', 'paragraph', 'image', 'button', 'list']) {
			assert.match(blocks, new RegExp(`<!-- wp:${type}`), `expected a wp:${type} block`);
		}

		const opens = (blocks.match(/<!-- wp:group -->/g) ?? []).length;
		const closes = (blocks.match(/<!-- \/wp:group -->/g) ?? []).length;
		assert.ok(opens > 0, 'expected at least one wp:group');
		assert.equal(opens, closes, 'wp:group open/close comments must balance');
	});
});

// ---------------------------------------------------------------------------
// Part B — end-to-end: deploy golden theme to Docker WP, activate, no fatals
// ---------------------------------------------------------------------------

const reachable = wpReachable();

describe('golden theme deploys to WordPress and renders cleanly', { skip: reachable ? false : 'Docker WordPress stack not reachable at ' + BASE_URL + ' — boot it with `./wordpress-local.sh start && ./wordpress-local.sh install` to run the end-to-end checks' }, () => {
	before(() => {
		// Deploy the golden theme into the container (see deployTheme for why we
		// go through Docker rather than writing the bind-mounted host dir).
		deployTheme();

		// Capture PHP issues to a log instead of the page, then start clean.
		wp(['config', 'set', 'WP_DEBUG', 'true', '--raw']);
		wp(['config', 'set', 'WP_DEBUG_LOG', 'true', '--raw']);
		wp(['config', 'set', 'WP_DEBUG_DISPLAY', 'false', '--raw']);
		dockerExec('rm -f wp-content/debug.log');

		wp(['theme', 'activate', THEME_SLUG]);
	});

	after(() => {
		// Switch off the fixture theme (activate any other installed theme) then
		// remove it, so the environment is left clean.
		try {
			const others = wp([
				'theme', 'list', '--field=name', '--status=inactive',
			]).split('\n').map((s) => s.trim()).filter(Boolean).filter((n) => n !== THEME_SLUG);
			if (others.length) wp(['theme', 'activate', others[0]]);
		} catch {
			/* best-effort */
		}
		removeTheme();
	});

	test('theme activates and becomes the active theme', () => {
		const active = wp(['theme', 'list', '--status=active', '--field=name']);
		assert.equal(active.trim(), THEME_SLUG);
	});

	test('front page renders with no PHP fatal and shows hero content', async () => {
		const { chromium } = await import('playwright');
		const browser = await chromium.launch();
		try {
			const page = await browser.newPage();
			const response = await page.goto(BASE_URL + '/', { waitUntil: 'load', timeout: 30_000 });
			assert.equal(response.status(), 200, 'front page should return HTTP 200');

			const body = await page.content();
			assert.doesNotMatch(body, /There has been a critical error/i, 'WordPress critical-error screen rendered');
			assert.doesNotMatch(body, /Fatal error/i, 'PHP fatal error surfaced in the page');
			assert.match(body, /Welcome to Acme/, 'hero pattern content should render');
		} finally {
			await browser.close();
		}
	});

	test('golden theme PHP files have no syntax errors', () => {
		const base = `wp-content/themes/${THEME_SLUG}`;
		// `php -l` exits non-zero on a parse error, which throws here.
		dockerExec(`php -l ${base}/functions.php`);
		dockerExec(`for f in ${base}/patterns/*.php; do php -l "$f"; done`);
	});

	test('no PHP fatals or parse errors were logged while rendering', () => {
		const log = dockerExec('test -f wp-content/debug.log && cat wp-content/debug.log || true');
		assert.doesNotMatch(log, /PHP (Fatal|Parse) error/i, `debug.log contains a fatal:\n${log}`);
	});

	test('deployed templates pass pattern-first and block-markup validation', () => {
		for (const tmpl of ['front-page.html', 'index.html']) {
			// Exits non-zero (throws) on a pattern-architecture violation.
			run('bash', ['scripts/canva-fse/validate-pattern-architecture.sh', `themes/${THEME_SLUG}/templates/${tmpl}`]);
		}
		for (const file of ['templates/front-page.html', 'parts/header.html', 'parts/footer.html', 'patterns/hero.php']) {
			const out = run('bash', ['-lc',
				`echo '{"tool_input":{"file_path":"themes/${THEME_SLUG}/${file}"}}' | bash scripts/block-markup-validator/validate-block-markup.sh 2>&1`]);
			assert.ok(!out.includes('❌'), `block-markup validator flagged ${file}:\n${out}`);
		}
	});
});
