#!/usr/bin/env node
/**
 * tests/visual/print-report.mjs
 *
 * Pretty-prints visual-diff.js batch JSON output AND emits GitHub Actions
 * workflow commands (::error:: / ::notice::) for native PR Check annotations.
 *
 * Usage: node tests/visual/print-report.mjs <report.json>
 */

import { readFileSync, existsSync } from "node:fs";

const reportPath = process.argv[2];
if (!reportPath || !existsSync(reportPath)) {
  console.error(`Usage: print-report.mjs <report.json>`);
  process.exit(2);
}

const report = JSON.parse(readFileSync(reportPath, "utf-8"));
const isCI = process.env.GITHUB_ACTIONS === "true";

console.log("");
console.log("=== Visual Regression Report ===");
console.log(`Total: ${report.totalFiles} | Pass: ${report.passed} | Fail: ${report.failed} | Skip: ${report.skipped}`);
console.log(`Overall: ${report.overallPass ? "PASS" : "FAIL"}`);
console.log("");

for (const r of report.results) {
  if (r.status === "SKIP" || r.status === "MISSING") {
    console.log(`  ${r.status}  ${r.file} — ${r.reason}`);
    if (isCI && r.status === "MISSING") {
      console.log(`::error file=tests/visual/baselines/${r.file},title=Missing baseline::Baseline image not found for ${r.file}. Run \`pnpm visual:update\` to capture.`);
    }
  } else {
    const pct = (r.mismatchPct * 100).toFixed(3);
    const status = r.pass ? "PASS" : "FAIL";
    console.log(`  ${status}  ${r.file} — ${pct}% diff (${r.diffPixels} pixels)`);
    if (!r.pass) {
      const regionNames = r.regions?.failing?.map((reg) => reg.name).join(", ") || "n/a";
      if (isCI) {
        console.log(
          `::error file=tests/visual/baselines/${r.file},title=Visual regression::${pct}% mismatch (threshold ${(r.threshold * 100).toFixed(2)}%). Problem regions: ${regionNames}. See tests/visual/diffs/diff-${r.file} in the workflow artifact.`,
        );
      } else if (r.regions?.failing?.length) {
        console.log(`         Problem regions: ${regionNames}`);
      }
    }
  }
}

if (isCI) {
  console.log("");
  console.log(`::notice title=Visual regression summary::${report.passed} passed, ${report.failed} failed, ${report.skipped} skipped of ${report.totalFiles} comparisons.`);
}

process.exit(report.overallPass ? 0 : 1);
