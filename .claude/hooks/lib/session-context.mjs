#!/usr/bin/env node
// session-context.mjs — print the short status block the SessionStart hook
// adds to context: conversion runs in flight (.claude/pipeline/<theme>/state.json),
// the themes under themes/, the Docker stack, .env, git, and the active hooks.
// Every section is optional and every failure is silent; the output is plain
// text. Silent outside a Flavian checkout (no bin/flavian.mjs).
//
// Usage: node session-context.mjs <project-dir>
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const projectDir = process.argv[2] || process.cwd();
if (!existsSync(join(projectDir, "bin", "flavian.mjs"))) process.exit(0);

const out = [];
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const list = (p) => { try { return readdirSync(p); } catch { return []; } };
const day = (iso) => (iso ? String(iso).slice(0, 10) : "");

// --- Conversion runs in flight ------------------------------------------------
const pipelineDir = join(projectDir, ".claude", "pipeline");
for (const slug of list(pipelineDir).sort()) {
  const state = readJson(join(pipelineDir, slug, "state.json"));
  if (!state) continue;
  const templates = Array.isArray(state.templates) ? state.templates : [];
  const done = templates.filter((t) => t && t.status === "done").length;
  const review = templates.filter((t) => t && ["needs-review", "failed"].includes(t.status)).length;
  const phase = state.phase ?? "?";
  if (phase === "done" || phase === "3" || state.phases?.["3"]?.status === "done") {
    out.push(`Last conversion: ${state.pipeline || "pipeline"} for theme ${state.theme || slug} finished ${day(state.updatedAt) || "?"} (${done}/${templates.length} templates done${review ? `, ${review} need review` : ""}).`);
    continue;
  }
  out.push(`Pipeline run in flight: ${state.pipeline || "pipeline"} for theme ${state.theme || slug}, phase ${phase}, templates ${done}/${templates.length} done${review ? `, ${review} need review` : ""}, updated ${day(state.updatedAt) || "?"}.`);
  out.push(`  resume: read .claude/pipeline/${slug}/state.json and continue the pipeline skill from the first template that is not done; do not re-run discovery.`);
}

// --- Themes ------------------------------------------------------------------------
const themesDir = join(projectDir, "themes");
if (isDir(themesDir)) {
  const themes = list(themesDir).filter((n) => isDir(join(themesDir, n)) && existsSync(join(themesDir, n, "style.css")));
  if (themes.length) {
    const names = themes.map((n) => {
      let title = "";
      try { title = (readFileSync(join(themesDir, n, "style.css"), "utf8").match(/Theme Name:\s*(.+)/) || [])[1]?.trim() || ""; } catch { /* unreadable */ }
      const fse = existsSync(join(themesDir, n, "theme.json")) ? "theme.json" : "classic";
      return `${n}${title && title !== n ? ` (${title})` : ""} [${fse}]`;
    });
    out.push(`Themes under themes/: ${names.join(", ")}.`);
  } else {
    out.push("Themes under themes/: none yet (pnpm run init scaffolds one).");
  }
}

// --- Docker stack and .env ------------------------------------------------------------
try {
  const ps = spawnSync("docker", ["ps", "--filter", "name=flavian", "--format", "{{.Names}}\t{{.Status}}"], { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] });
  if (ps.status === 0) {
    const rows = ps.stdout.split("\n").filter(Boolean);
    out.push(rows.length ? `Docker stack: ${rows.length} flavian container(s) running (${rows.map((r) => r.split("\t")[0]).join(", ")}).` : "Docker stack: not running (docker compose up -d wordpress db).");
  }
} catch { /* docker missing or slow */ }
if (!existsSync(join(projectDir, ".env"))) out.push("No .env yet: pnpm run init writes one (see docs/CLI-WIZARD.md).");

// --- Git ---------------------------------------------------------------------------------
try {
  const git = (...args) => execFileSync("git", args, { cwd: projectDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  const dirty = git("status", "--porcelain", "--", "themes", "plugins", "mu-plugins").split("\n").filter(Boolean).length;
  if (/^(main|master)$/.test(branch)) out.push(`On ${branch}${dirty ? ` with ${dirty} uncommitted file(s) under themes/, plugins/ or mu-plugins/` : ""}: start a feature branch before changing anything.`);
  else out.push(`Branch ${branch}${dirty ? `: ${dirty} uncommitted file(s) under themes/, plugins/ or mu-plugins/` : ""}.`);
  const stray = git("ls-files", "--", "wp-content").split("\n").filter(Boolean).length;
  if (stray) out.push(`WARNING: ${stray} file(s) tracked under wp-content/. This project develops in root-level themes/, plugins/ and mu-plugins/; move them (git mv) and let the deploy scripts fill wp-content/.`);
} catch { /* not a git checkout */ }

out.push("Hooks active: root-level layout guard on Write/Edit (denies wp-content/ paths), deploy guard (asks before production deploys, rollbacks, remote writes and local data loss; denies them in subagents), token and size checks on git commit, quality-gate reminders after standards checks, test runs and visual diffs.");

process.stdout.write(`Flavian status\n${out.map((l) => (l.startsWith("  ") ? l : `- ${l}`)).join("\n")}\n`);
