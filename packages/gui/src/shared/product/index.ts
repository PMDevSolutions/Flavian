/**
 * Product registry + the single switch point for which product the shell drives.
 *
 * This is the engine's entry into the per-product layer: main and the renderer both
 * import `activeManifest` from here, and `getScreen`/`getStep` are the typed lookups
 * the engine uses instead of hard-coding Flavian specifics.
 *
 * ── Extension point ─────────────────────────────────────────────────────────────
 * Adding a second product (the staged plan's "prove reuse with Aurelius" step) is:
 *   1. author packages/gui/src/shared/product/aurelius.ts (another ProductManifest);
 *   2. register it in PRODUCTS below;
 *   3. flip ACTIVE_PRODUCT_ID (or, for the unified Trajan app, choose it at runtime).
 * No engine/core/renderer change is required. A scaffold lives in ./aurelius — it is
 * intentionally NOT wired in here yet.
 *     // import { aureliusManifest } from './aurelius';
 *     // export const PRODUCTS = { flavian: flavianManifest, aurelius: aureliusManifest };
 * ────────────────────────────────────────────────────────────────────────────────
 */
import { flavianManifest } from './flavian';
import type { ProductId, ProductManifest, ProductScreen, ProductStep, ScreenId } from './manifest';

export type { ProductManifest, ProductScreen, ProductStep, ScreenId, ProductId } from './manifest';

/** Every product the engine knows how to render. */
export const PRODUCTS: Readonly<Record<string, ProductManifest>> = {
  flavian: flavianManifest,
};

/** The product this build ships. The unified Trajan app will select this at runtime. */
export const ACTIVE_PRODUCT_ID: ProductId = 'flavian';

/** The manifest the engine renders. */
export const activeManifest: ProductManifest = PRODUCTS[ACTIVE_PRODUCT_ID];

/** Look up a screen by id (throws on a misconfigured manifest — a programming error). */
export function getScreen(manifest: ProductManifest, id: ScreenId): ProductScreen {
  const screen = manifest.screens.find((s) => s.id === id);
  if (!screen) throw new Error(`Product "${manifest.id}" has no "${id}" screen.`);
  return screen;
}

/** Look up a step within a screen by id (throws if absent). */
export function getStep(screen: ProductScreen, id: string): ProductStep {
  const step = screen.steps.find((s) => s.id === id);
  if (!step) throw new Error(`Screen "${screen.id}" has no "${id}" step.`);
  return step;
}

/** The sole step of a single-operation screen (prereq, wizard). */
export function soleStep(manifest: ProductManifest, screenId: ScreenId): ProductStep {
  const screen = getScreen(manifest, screenId);
  const step = screen.steps[0];
  if (!step) throw new Error(`Screen "${screenId}" has no steps.`);
  return step;
}

/**
 * The repo-relative directory the init wizard imports its resolver/apply from.
 * Read from the wizard step's `module` command so the path lives only in the manifest.
 */
export function initModuleDir(manifest: ProductManifest): string {
  const { command } = soleStep(manifest, 'wizard');
  if (command.exec !== 'module') {
    throw new Error(`Product "${manifest.id}" wizard step is not a 'module' command.`);
  }
  return command.module;
}
