#!/usr/bin/env node
/**
 * tests/lighthouse/annotate-report.mjs
 *
 * Reads lhci's assertion-results.json + lhr-*.json under .lighthouseci/
 * and emits GitHub Actions workflow commands (::error:: / ::warning::)
 * so individual budget violations surface as native check annotations on
 * the PR rather than buried in the workflow log.
 *
 * Usage:
 *   node tests/lighthouse/annotate-report.mjs [.lighthouseci-dir]
 *
 * Exit code: 0 always. (CI status is already set by lhci's own exit code.)
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve(process.argv[2] || ".lighthouseci");
const isCI = process.env.GITHUB_ACTIONS === "true";

if (!existsSync(dir)) {
  console.error(`lhci output dir not found: ${dir}`);
  process.exit(0);
}

const assertionFile = join(dir, "assertion-results.json");
if (!existsSync(assertionFile)) {
  console.log("No assertion-results.json — nothing to annotate.");
  process.exit(0);
}

const results = JSON.parse(readFileSync(assertionFile, "utf-8"));
const failures = results.filter((r) => r.passed === false);

if (failures.length === 0) {
  console.log("All Lighthouse assertions passed.");
  process.exit(0);
}

console.log(`\n=== Lighthouse budget violations (${failures.length}) ===\n`);

for (const f of failures) {
  const level = f.level === "warn" ? "warning" : "error";
  const url = f.url || "(unknown URL)";
  const audit = f.auditId || f.name;
  const expected = f.expected ?? "?";
  const actual = f.actual ?? "?";
  const op = f.operator || "vs";
  const msg = `${url} — ${audit}: ${actual} ${op} ${expected}`;

  console.log(`  [${level.toUpperCase()}] ${msg}`);

  if (isCI) {
    console.log(`::${level} title=Lighthouse ${audit}::${msg}`);
  }
}

// Best-effort: surface the temporary-public-storage URL if lhci wrote a links file.
const linksFile = join(dir, "links.json");
if (existsSync(linksFile)) {
  try {
    const links = JSON.parse(readFileSync(linksFile, "utf-8"));
    const urls = Object.values(links).filter(Boolean);
    if (urls.length && isCI) {
      console.log(
        `::notice title=Lighthouse reports::Public report URLs: ${urls.join(" ")}`,
      );
    }
  } catch {
    // ignore parse error
  }
}

// Also list any lhr-*.json HTML reports the artifact will contain.
try {
  const reports = readdirSync(dir).filter((f) => f.startsWith("lhr-") && f.endsWith(".html"));
  if (reports.length && isCI) {
    console.log(
      `::notice title=Lighthouse HTML reports::Download the workflow artifact to see ${reports.length} HTML report(s).`,
    );
  }
} catch {
  // ignore
}

// Don't fail here — lhci already set the exit code.
process.exit(0);
