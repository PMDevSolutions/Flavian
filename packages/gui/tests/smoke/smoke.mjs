// Packaged-build smoke test: launch the built Electron app and assert it boots to
// the shell and reaches a usable view (the Prerequisites/setup view or the project
// gate). Requires `electron-vite build` to have produced out/ first.
//
// Run: pnpm --filter @flavian/gui build && pnpm --filter @flavian/gui smoke
// In headless CI (Linux), wrap with `xvfb-run`.
import { _electron as electron } from 'playwright';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';

const mainPath = fileURLToPath(new URL('../../out/main/index.js', import.meta.url));

const app = await electron.launch({ args: [mainPath] });
try {
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  // The shell always renders the "Flavian" brand; content is either the default
  // Prerequisites view (when a project is found) or the "Open a Flavian project" gate.
  await win.waitForSelector('.brand', { timeout: 30_000 });
  const brand = ((await win.textContent('.brand')) ?? '').trim();
  assert.equal(brand, 'Flavian', 'app shell (brand) did not render');

  const body = (await win.textContent('body')) ?? '';
  assert.ok(
    /Prerequisites|Open a Flavian project/.test(body),
    'expected the setup view (Prerequisites) or the project gate',
  );

  console.log('smoke: GUI launched and reached the setup view');
} finally {
  await app.close();
}
