#!/usr/bin/env node
/**
 * tests/visual/capture.mjs
 *
 * Drives Playwright to capture full-page screenshots of every configured URL
 * at every configured breakpoint, with dynamic-content selectors masked.
 *
 * Reads:
 *   tests/visual/urls.json     — baseUrl, breakpoints, pages[]
 *   tests/visual/masks.json    — { "*": [...], "/path/": [...] }
 *
 * Writes PNGs to the directory passed via --out (default: tests/visual/actual/).
 * Filenames are deterministic: <slug>-<breakpoint>-<width>px.png
 *
 * Exit codes: 0 = all captured, 1 = at least one capture failed.
 */

import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const opts = { out: "tests/visual/actual", urls: null, masks: null, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") opts.out = argv[++i];
    else if (a === "--urls") opts.urls = argv[++i];
    else if (a === "--masks") opts.masks = argv[++i];
    else if (a === "--only") opts.only = argv[++i];
    else if (a === "-h" || a === "--help") {
      console.log("Usage: node tests/visual/capture.mjs [--out dir] [--urls file] [--masks file] [--only slug]");
      process.exit(0);
    }
  }
  return opts;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function masksForPath(masks, urlPath) {
  const universal = masks["*"] ?? [];
  const specific = masks[urlPath] ?? [];
  return [...universal, ...specific];
}

async function captureOne(browser, baseUrl, page, breakpointName, width, height, maskSelectors, outDir) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const tab = await ctx.newPage();
  const url = baseUrl + page.path;

  try {
    await tab.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    // Stop animations and pin time-sensitive locales for stability.
    await tab.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          caret-color: transparent !important;
        }
      `,
    });
    await tab.evaluate(() => document.fonts && document.fonts.ready);

    const masks = [];
    for (const sel of maskSelectors) {
      try {
        const locator = tab.locator(sel);
        const count = await locator.count();
        if (count > 0) masks.push(locator);
      } catch {
        // Ignore invalid selectors — fail loud only when capture fails.
      }
    }

    const filename = `${page.slug}-${breakpointName}-${width}px.png`;
    const outPath = join(outDir, filename);
    await tab.screenshot({
      path: outPath,
      fullPage: true,
      mask: masks,
      maskColor: "#FF00FF",
      animations: "disabled",
      caret: "hide",
    });
    return { ok: true, file: filename, url, breakpoint: breakpointName, width };
  } catch (err) {
    return { ok: false, file: `${page.slug}-${breakpointName}-${width}px.png`, url, breakpoint: breakpointName, width, error: err.message };
  } finally {
    await ctx.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(__dirname, "..", "..");

  const urlsPath = args.urls ? resolve(args.urls) : join(repoRoot, "tests/visual/urls.json");
  const masksPath = args.masks ? resolve(args.masks) : join(repoRoot, "tests/visual/masks.json");
  const outDir = resolve(args.out);

  if (!existsSync(urlsPath)) {
    console.error(`urls.json not found at ${urlsPath}`);
    process.exit(2);
  }
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const urls = loadJson(urlsPath);
  const masks = existsSync(masksPath) ? loadJson(masksPath) : {};
  const pages = args.only ? urls.pages.filter((p) => p.slug === args.only) : urls.pages;

  if (pages.length === 0) {
    console.error(args.only ? `No page with slug "${args.only}"` : "No pages configured");
    process.exit(2);
  }

  console.log(`▸ Capturing ${pages.length} page(s) × ${Object.keys(urls.breakpoints).length} breakpoint(s) → ${outDir}`);

  const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--disable-skia-runtime-opts"] });
  const results = [];

  try {
    for (const page of pages) {
      const pageMasks = masksForPath(masks, page.path);
      for (const [bpName, width] of Object.entries(urls.breakpoints)) {
        const result = await captureOne(browser, urls.baseUrl, page, bpName, width, 900, pageMasks, outDir);
        results.push(result);
        const status = result.ok ? "✓" : "✗";
        console.log(`  ${status} ${result.file}${result.error ? `  — ${result.error}` : ""}`);
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log("");
  console.log(`Done: ${results.length - failed.length}/${results.length} captured.`);
  if (failed.length) {
    console.log(`Failures: ${failed.length}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
