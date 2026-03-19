#!/usr/bin/env node
/**
 * visual-diff.js — Pixel-level screenshot comparison using pixelmatch
 *
 * Usage:
 *   node scripts/visual-diff.js <actual> <expected> [--output <diff.png>] [--threshold <0.02>] [--json]
 *   node scripts/visual-diff.js --batch <dir-actual> <dir-expected> [--output-dir <diffs/>] [--threshold <0.02>]
 *
 * Outputs:
 *   - Diff image (magenta highlights)
 *   - Mismatch percentage
 *   - Region-based analysis (which quadrants differ)
 *   - Exit code: 0 = pass, 1 = fail (above threshold), 2 = error
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join, basename, extname, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load pipeline config for defaults
function loadConfig() {
  const configPath = join(__dirname, "..", ".claude", "pipeline.config.json");
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}

function parseArgs(args) {
  const parsed = {
    mode: "single", // single | batch
    actual: null,
    expected: null,
    output: null,
    outputDir: null,
    threshold: null,
    json: false,
    regionGrid: null,
    antialiasing: null,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case "--batch":
        parsed.mode = "batch";
        break;
      case "--output":
        parsed.output = args[++i];
        break;
      case "--output-dir":
        parsed.outputDir = args[++i];
        break;
      case "--threshold":
        parsed.threshold = parseFloat(args[++i]);
        break;
      case "--json":
        parsed.json = true;
        break;
      case "--region-grid":
        parsed.regionGrid = parseInt(args[++i], 10);
        break;
      case "--antialiasing":
        parsed.antialiasing = args[++i] !== "false";
        break;
      default:
        if (!parsed.actual) parsed.actual = arg;
        else if (!parsed.expected) parsed.expected = arg;
        break;
    }
    i++;
  }

  return parsed;
}

function loadPNG(filepath) {
  const buffer = readFileSync(filepath);
  return PNG.sync.read(buffer);
}

function savePNG(filepath, png) {
  const dir = dirname(filepath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const buffer = PNG.sync.write(png);
  writeFileSync(filepath, buffer);
}

/**
 * Analyze which regions of the image have the most differences.
 * Divides the image into a grid and reports mismatch per cell.
 */
function analyzeRegions(diffData, width, height, gridSize) {
  const cellW = Math.ceil(width / gridSize);
  const cellH = Math.ceil(height / gridSize);
  const regions = [];

  const regionNames = {
    "0,0": "top-left",
    "1,0": "top-center-left",
    "2,0": "top-center-right",
    "3,0": "top-right",
    "0,1": "upper-left",
    "1,1": "upper-center-left",
    "2,1": "upper-center-right",
    "3,1": "upper-right",
    "0,2": "lower-left",
    "1,2": "lower-center-left",
    "2,2": "lower-center-right",
    "3,2": "lower-right",
    "0,3": "bottom-left",
    "1,3": "bottom-center-left",
    "2,3": "bottom-center-right",
    "3,3": "bottom-right",
  };

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const startX = gx * cellW;
      const startY = gy * cellH;
      const endX = Math.min(startX + cellW, width);
      const endY = Math.min(startY + cellH, height);
      const cellPixels = (endX - startX) * (endY - startY);

      let diffPixels = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          // Diff pixels are magenta (255, 0, 255) — check R and B channels
          if (diffData[idx] === 255 && diffData[idx + 1] === 0 && diffData[idx + 2] === 255) {
            diffPixels++;
          }
        }
      }

      const mismatchPct = cellPixels > 0 ? diffPixels / cellPixels : 0;
      const key = `${gx},${gy}`;

      regions.push({
        name: regionNames[key] || `region-${gx}-${gy}`,
        gridX: gx,
        gridY: gy,
        bounds: { x: startX, y: startY, width: endX - startX, height: endY - startY },
        diffPixels,
        totalPixels: cellPixels,
        mismatchPct: Math.round(mismatchPct * 10000) / 10000,
        status: mismatchPct <= 0.01 ? "pass" : mismatchPct <= 0.05 ? "warn" : "fail",
      });
    }
  }

  return regions.sort((a, b) => b.mismatchPct - a.mismatchPct);
}

function compareSingle(actualPath, expectedPath, options) {
  const config = loadConfig();
  const vdConfig = config?.visualDiff || {};
  const iterConfig = config?.iterationLoop || {};

  const threshold = options.threshold ?? vdConfig.threshold ?? 0.02;
  const antialiasing = options.antialiasing ?? vdConfig.antialiasing ?? true;
  const regionGrid = options.regionGrid ?? iterConfig.regionGridSize ?? 4;
  const diffColor = vdConfig.diffColorRgb || [255, 0, 255];

  const actual = loadPNG(actualPath);
  const expected = loadPNG(expectedPath);

  // Handle size mismatch by scaling to the larger dimensions
  const width = Math.max(actual.width, expected.width);
  const height = Math.max(actual.height, expected.height);

  // Create canvases at the target size
  function resizeToCanvas(src, w, h) {
    if (src.width === w && src.height === h) return src.data;
    const canvas = new Uint8Array(w * h * 4);
    // Fill with white (transparent areas become white for comparison)
    canvas.fill(255);
    for (let y = 0; y < src.height && y < h; y++) {
      for (let x = 0; x < src.width && x < w; x++) {
        const srcIdx = (y * src.width + x) * 4;
        const dstIdx = (y * w + x) * 4;
        canvas[dstIdx] = src.data[srcIdx];
        canvas[dstIdx + 1] = src.data[srcIdx + 1];
        canvas[dstIdx + 2] = src.data[srcIdx + 2];
        canvas[dstIdx + 3] = src.data[srcIdx + 3];
      }
    }
    return canvas;
  }

  const actualData = resizeToCanvas(actual, width, height);
  const expectedData = resizeToCanvas(expected, width, height);

  const diff = new PNG({ width, height });
  const numDiffPixels = pixelmatch(actualData, expectedData, diff.data, width, height, {
    threshold: 0.1, // per-pixel color distance threshold
    includeAA: !antialiasing,
    diffColor,
    alpha: 0.3,
  });

  const totalPixels = width * height;
  const mismatchPct = totalPixels > 0 ? numDiffPixels / totalPixels : 0;
  const pass = mismatchPct <= threshold;

  // Region analysis
  const regions = analyzeRegions(diff.data, width, height, regionGrid);
  const failingRegions = regions.filter((r) => r.status === "fail");
  const warningRegions = regions.filter((r) => r.status === "warn");

  // Save diff image if output specified
  const outputPath =
    options.output || (options.outputDir ? join(options.outputDir, `diff-${basename(actualPath)}`) : null);

  if (outputPath) {
    savePNG(outputPath, diff);
  }

  return {
    actual: resolve(actualPath),
    expected: resolve(expectedPath),
    diffImage: outputPath ? resolve(outputPath) : null,
    dimensions: { width, height, actualSize: `${actual.width}x${actual.height}`, expectedSize: `${expected.width}x${expected.height}` },
    totalPixels,
    diffPixels: numDiffPixels,
    mismatchPct: Math.round(mismatchPct * 10000) / 10000,
    threshold,
    pass,
    status: pass ? "PASS" : "FAIL",
    regions: {
      gridSize: regionGrid,
      failing: failingRegions,
      warning: warningRegions,
      summary:
        failingRegions.length === 0
          ? "All regions within tolerance"
          : `${failingRegions.length} region(s) exceed threshold: ${failingRegions.map((r) => r.name).join(", ")}`,
    },
  };
}

function compareBatch(actualDir, expectedDir, options) {
  const config = loadConfig();
  const outputDir = options.outputDir || config?.visualDiff?.outputDir || ".claude/visual-qa/diffs";

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const actualFiles = readdirSync(actualDir).filter((f) => extname(f).toLowerCase() === ".png");
  const expectedFiles = new Set(readdirSync(expectedDir).filter((f) => extname(f).toLowerCase() === ".png"));

  const results = [];
  let overallPass = true;

  for (const file of actualFiles) {
    if (!expectedFiles.has(file)) {
      results.push({
        file,
        status: "SKIP",
        reason: `No matching expected file: ${file}`,
      });
      continue;
    }

    const result = compareSingle(join(actualDir, file), join(expectedDir, file), {
      ...options,
      output: join(outputDir, `diff-${file}`),
    });

    results.push({ file, ...result });
    if (!result.pass) overallPass = false;
  }

  // Check for expected files with no actual counterpart
  for (const file of expectedFiles) {
    if (!actualFiles.includes(file)) {
      results.push({
        file,
        status: "MISSING",
        reason: `Expected file has no actual counterpart: ${file}`,
      });
      overallPass = false;
    }
  }

  return {
    mode: "batch",
    actualDir: resolve(actualDir),
    expectedDir: resolve(expectedDir),
    outputDir: resolve(outputDir),
    totalFiles: actualFiles.length,
    passed: results.filter((r) => r.pass === true).length,
    failed: results.filter((r) => r.pass === false).length,
    skipped: results.filter((r) => r.status === "SKIP" || r.status === "MISSING").length,
    overallPass,
    results,
  };
}

function formatHumanReadable(result) {
  const lines = [];

  if (result.mode === "batch") {
    lines.push("=== Visual Diff Report (Batch) ===");
    lines.push(`Actual:   ${result.actualDir}`);
    lines.push(`Expected: ${result.expectedDir}`);
    lines.push(`Diffs:    ${result.outputDir}`);
    lines.push("");
    lines.push(`Total: ${result.totalFiles} | Pass: ${result.passed} | Fail: ${result.failed} | Skip: ${result.skipped}`);
    lines.push(`Overall: ${result.overallPass ? "PASS" : "FAIL"}`);
    lines.push("");

    for (const r of result.results) {
      if (r.status === "SKIP" || r.status === "MISSING") {
        lines.push(`  ${r.status} ${r.file} — ${r.reason}`);
      } else {
        const pct = (r.mismatchPct * 100).toFixed(2);
        lines.push(`  ${r.status} ${r.file} — ${pct}% diff (${r.diffPixels} pixels)`);
        if (r.regions?.failing?.length > 0) {
          lines.push(`       Problem areas: ${r.regions.failing.map((r) => r.name).join(", ")}`);
        }
      }
    }
  } else {
    const pct = (result.mismatchPct * 100).toFixed(2);
    lines.push("=== Visual Diff Report ===");
    lines.push(`Actual:    ${result.actual}`);
    lines.push(`Expected:  ${result.expected}`);
    if (result.diffImage) lines.push(`Diff:      ${result.diffImage}`);
    lines.push("");
    lines.push(`Dimensions:  ${result.dimensions.width}x${result.dimensions.height}`);
    if (result.dimensions.actualSize !== result.dimensions.expectedSize) {
      lines.push(`  (actual: ${result.dimensions.actualSize}, expected: ${result.dimensions.expectedSize})`);
    }
    lines.push(`Diff pixels: ${result.diffPixels} / ${result.totalPixels} (${pct}%)`);
    lines.push(`Threshold:   ${(result.threshold * 100).toFixed(2)}%`);
    lines.push(`Status:      ${result.status}`);
    lines.push("");

    if (result.regions.failing.length > 0) {
      lines.push("Problem Regions:");
      for (const r of result.regions.failing) {
        lines.push(`  FAIL  ${r.name} — ${(r.mismatchPct * 100).toFixed(2)}% diff`);
      }
    }
    if (result.regions.warning.length > 0) {
      lines.push("Warning Regions:");
      for (const r of result.regions.warning) {
        lines.push(`  WARN  ${r.name} — ${(r.mismatchPct * 100).toFixed(2)}% diff`);
      }
    }
    if (result.regions.failing.length === 0 && result.regions.warning.length === 0) {
      lines.push("All regions within tolerance.");
    }
  }

  return lines.join("\n");
}

// --- Main ---
const args = parseArgs(process.argv.slice(2));

if (!args.actual || !args.expected) {
  console.error("Usage:");
  console.error("  node scripts/visual-diff.js <actual.png> <expected.png> [options]");
  console.error("  node scripts/visual-diff.js --batch <actual-dir> <expected-dir> [options]");
  console.error("");
  console.error("Options:");
  console.error("  --output <file>       Output diff image path (single mode)");
  console.error("  --output-dir <dir>    Output directory for diff images (batch mode)");
  console.error("  --threshold <0.02>    Max mismatch ratio to pass (default: from pipeline config)");
  console.error("  --region-grid <4>     Grid divisions for region analysis (default: 4)");
  console.error("  --antialiasing <bool> Ignore antialiasing differences (default: true)");
  console.error("  --json                Output JSON instead of human-readable");
  process.exit(2);
}

try {
  let result;

  if (args.mode === "batch") {
    result = compareBatch(args.actual, args.expected, args);
  } else {
    result = compareSingle(args.actual, args.expected, args);
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatHumanReadable(result));
  }

  const exitCode = args.mode === "batch" ? (result.overallPass ? 0 : 1) : result.pass ? 0 : 1;
  process.exit(exitCode);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(2);
}
