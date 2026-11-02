#!/usr/bin/env node
/**
 * claude-code-conformance.js — check this repo's Claude Code configuration
 * against the current Claude Code spec (scripts/lib/claude-code-spec.json).
 *
 * Copied from PMDevSolutions/Maecenas (scripts/claude-code-conformance.js) on
 * 2026-11-02; each PMDS repo carries its own copy so it can be checked without a
 * sibling checkout. Keep the copies in sync when the spec changes.
 *
 * Catches the drift that bites a framework built on an older Claude Code:
 *   • agents that list retired tools (MultiEdit, Task, TaskOutput, KillShell …)
 *     or tools a subagent can never have (AskUserQuestion)
 *   • unknown frontmatter fields on agents, skills, and rules (`globs:` …)
 *   • invalid values (color, model, permissionMode, effort, memory, booleans)
 *   • `skills:` / `agent:` references that point at nothing
 *   • legacy .claude/commands/ files (merged into skills)
 *   • hooks in settings.json that use the retired $TOOL_INPUT/$TOOL_OUTPUT
 *     contract, unknown events or handler types, or scripts that do not exist
 *   • plugin.json paths that do not start with ./ or do not exist
 *   • live docs that still name retired tools
 *
 * Usage:
 *   node scripts/claude-code-conformance.js [--root <dir>] [--json] [--strict]
 *
 * Exit codes: 0 = clean (warnings allowed; --strict makes warnings fail),
 *             1 = errors found, 2 = usage/IO error.
 */
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC = JSON.parse(readFileSync(join(__dirname, "lib", "claude-code-spec.json"), "utf8"));

// --- CLI -------------------------------------------------------------------
const argv = process.argv.slice(2);
let root = process.cwd();
let json = false;
let strict = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--json") json = true;
  else if (a === "--strict") strict = true;
  else if (a === "--root") root = resolve(argv[++i] ?? "");
  else if (a === "-h" || a === "--help") {
    process.stdout.write(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 23).map((l) => l.replace(/^ \*\/?\s?/, "")).join("\n") + "\n");
    process.exit(0);
  } else {
    process.stderr.write(`Unknown argument: ${a}\n`);
    process.exit(2);
  }
}
if (!existsSync(root)) { process.stderr.write(`No such directory: ${root}\n`); process.exit(2); }

const findings = [];
const add = (severity, file, message) => findings.push({ severity, file: relative(root, file) || ".", message });
const error = (file, message) => add("error", file, message);
const warn = (file, message) => add("warning", file, message);

// --- Frontmatter parser (YAML subset: scalars, inline lists, nested lists/maps) ---
export function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) return { fields: null, body: text, reason: "missing frontmatter" };
  const end = text.indexOf("\n---", 4);
  if (end < 0) return { fields: null, body: text, reason: "unterminated frontmatter" };
  const block = text.slice(4, end);
  const fields = {};
  let current = null;
  for (const raw of block.split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const top = raw.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
    if (top) {
      current = top[1];
      const value = (top[2] ?? "").trim();
      fields[current] = value === "" ? [] : value;
      continue;
    }
    if (current && /^\s+/.test(raw)) {
      if (!Array.isArray(fields[current])) fields[current] = [fields[current]];
      fields[current].push(raw.trim().replace(/^-\s+/, ""));
      continue;
    }
    return { fields: null, body: text, reason: `unparsed line: ${raw}` };
  }
  return { fields, body: text.slice(end + 4) };
}

const asList = (v) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map((s) => String(s).trim().replace(/^"(.*)"$/, "$1")).filter(Boolean);
const isBool = (v) => /^(true|false|yes|no|on|off|1|0)$/i.test(String(v));
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } }; // dangling symlinks are not dirs
const listDirs = (dir) => (existsSync(dir) ? readdirSync(dir).filter((n) => isDir(join(dir, n))) : []);
const listMd = (dir) => (existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith(".md") && !/^readme\.md$/i.test(n)) : []);

const agentsDir = join(root, ".claude", "agents");
const skillsDir = join(root, ".claude", "skills");
const skillNames = new Set(listDirs(skillsDir).filter((d) => existsSync(join(skillsDir, d, "SKILL.md"))));
const agentNames = new Set(listMd(agentsDir).map((f) => f.replace(/\.md$/, "")));

// --- Tool token validation ---------------------------------------------------
function checkToolToken(file, token, { subagent }) {
  if (SPEC.retiredTools[token]) { error(file, `tools: "${token}" is retired (${SPEC.retiredTools[token]})`); return; }
  if (/^mcp__[\w.-]+(__[\w*.-]+)?$/.test(token) || token === "mcp__*") return;
  const agentMatch = token.match(/^Agent\((.+)\)$/);
  if (agentMatch) {
    for (const t of agentMatch[1].split(",").map((s) => s.trim())) {
      if (!agentNames.has(t) && !["general-purpose", "Explore", "Plan"].includes(t)) warn(file, `tools: Agent(${t}) names an agent type that is not in .claude/agents/`);
    }
    return;
  }
  const bare = token.replace(/\(.*\)$/, "");
  if (!SPEC.builtinTools.includes(bare)) { error(file, `tools: "${token}" is not a known built-in tool`); return; }
  if (subagent && SPEC.subagentUnavailableTools.includes(bare)) error(file, `tools: "${bare}" is never available inside a subagent`);
  if (SPEC.modelGatedTools[bare]) warn(file, `tools: "${bare}" is ${SPEC.modelGatedTools[bare]}`);
}

// --- Agents ------------------------------------------------------------------
for (const f of listMd(agentsDir)) {
  const file = join(agentsDir, f);
  const { fields, reason } = parseFrontmatter(readFileSync(file, "utf8"));
  if (!fields) { error(file, `frontmatter: ${reason}`); continue; }
  for (const k of SPEC.agentFields.required) if (fields[k] == null || fields[k] === "" || (Array.isArray(fields[k]) && !fields[k].length)) error(file, `frontmatter: missing required field "${k}"`);
  for (const k of Object.keys(fields)) if (![...SPEC.agentFields.required, ...SPEC.agentFields.optional].includes(k)) error(file, `frontmatter: unknown field "${k}"`);
  if (fields.name && fields.name !== f.replace(/\.md$/, "")) error(file, `frontmatter: name "${fields.name}" does not match the filename`);
  if (fields.tools) for (const t of asList(fields.tools)) checkToolToken(file, t, { subagent: true });
  if (fields.disallowedTools) for (const t of asList(fields.disallowedTools)) if (SPEC.retiredTools[t]) warn(file, `disallowedTools: "${t}" is retired and never offered anyway`);
  if (fields.color && !SPEC.colors.includes(String(fields.color))) error(file, `color: "${fields.color}" is not one of ${SPEC.colors.join(", ")}`);
  if (fields.model && !SPEC.models.includes(String(fields.model)) && !/^claude-[\w.-]+$/.test(String(fields.model))) error(file, `model: "${fields.model}" is not an alias or a full model id`);
  if (fields.permissionMode && !SPEC.permissionModes.includes(String(fields.permissionMode))) error(file, `permissionMode: "${fields.permissionMode}" is invalid`);
  if (fields.effort && !SPEC.efforts.includes(String(fields.effort))) error(file, `effort: "${fields.effort}" is invalid`);
  if (fields.memory && !SPEC.memoryScopes.includes(String(fields.memory))) error(file, `memory: "${fields.memory}" is invalid`);
  if (fields.isolation && String(fields.isolation) !== "worktree") error(file, `isolation: "${fields.isolation}" is invalid (only "worktree")`);
  if (fields.maxTurns && !/^\d+$/.test(String(fields.maxTurns))) error(file, `maxTurns: "${fields.maxTurns}" is not an integer`);
  if (fields.autoCompactWindow != null && !(/^\d+$/.test(String(fields.autoCompactWindow)) && +fields.autoCompactWindow >= 100000 && +fields.autoCompactWindow <= 1000000)) error(file, `autoCompactWindow: "${fields.autoCompactWindow}" must be a token count from 100000 to 1000000`);
  for (const k of ["background", "omitClaudeMd"]) if (fields[k] != null && !isBool(fields[k])) error(file, `${k}: "${fields[k]}" is not a boolean`);
  if (fields.skills) for (const s of asList(fields.skills)) if (!skillNames.has(s) && !s.includes(":")) error(file, `skills: "${s}" is not a skill in .claude/skills/`);
  if (fields.hooks) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/\.claude\/hooks\/([\w.-]+\.sh)/g)) if (!existsSync(join(root, ".claude", "hooks", m[1]))) error(file, `hooks: references missing script .claude/hooks/${m[1]}`);
  }
}

// --- Skills ------------------------------------------------------------------
for (const d of listDirs(skillsDir)) {
  const file = join(skillsDir, d, "SKILL.md");
  if (!existsSync(file)) { warn(join(skillsDir, d), "skill directory without SKILL.md"); continue; }
  const { fields, reason, body } = parseFrontmatter(readFileSync(file, "utf8"));
  if (!fields) { error(file, `frontmatter: ${reason}`); continue; }
  for (const k of Object.keys(fields)) {
    if (k === "globs") { error(file, `frontmatter: "globs" is not a field; path scoping is "paths"`); continue; }
    if (![...SPEC.skillFields.required, ...SPEC.skillFields.optional].includes(k)) error(file, `frontmatter: unknown field "${k}"`);
  }
  if (fields.name && fields.name !== d) warn(file, `frontmatter: name "${fields.name}" differs from the directory name "${d}" (the slash command is /${fields.name})`);
  if (!fields.description) warn(file, "frontmatter: no description, so Claude will never auto-invoke this skill");
  if (fields.context && String(fields.context) !== "fork") error(file, `context: "${fields.context}" is invalid (only "fork")`);
  if (fields.agent && !agentNames.has(String(fields.agent)) && !["general-purpose", "Explore", "Plan"].includes(String(fields.agent))) error(file, `agent: "${fields.agent}" is not an agent in .claude/agents/`);
  if (fields.agent && !fields.context) warn(file, "agent: set without context: fork has no effect");
  for (const k of ["disable-model-invocation", "user-invocable", "background"]) if (fields[k] != null && !isBool(fields[k])) error(file, `${k}: "${fields[k]}" is not a boolean`);
  if (fields.effort && !SPEC.efforts.includes(String(fields.effort))) error(file, `effort: "${fields.effort}" is invalid`);
  if (fields["allowed-tools"]) for (const t of asList(fields["allowed-tools"])) { const bare = t.replace(/\(.*\)$/, ""); if (SPEC.retiredTools[bare]) error(file, `allowed-tools: "${bare}" is retired (${SPEC.retiredTools[bare]})`); }
  const lines = body.split("\n").length;
  if (lines > 500) warn(file, `SKILL.md is ${lines} lines; the docs recommend under 500 with reference material in sibling files`);
}

// --- Legacy commands -----------------------------------------------------------
const commandsDir = join(root, ".claude", "commands");
for (const f of listMd(commandsDir)) {
  const name = f.replace(/\.md$/, "");
  if (skillNames.has(name)) warn(join(commandsDir, f), `shadowed: a skill named "${name}" takes precedence; delete the command file`);
  else warn(join(commandsDir, f), "legacy custom command; commands are merged into skills — move to .claude/skills/<name>/SKILL.md");
}

// --- Rules --------------------------------------------------------------------
const rulesDir = join(root, ".claude", "rules");
for (const f of listMd(rulesDir)) {
  const file = join(rulesDir, f);
  const text = readFileSync(file, "utf8");
  if (!text.startsWith("---\n")) continue; // rules without frontmatter load unconditionally
  const { fields, reason } = parseFrontmatter(text);
  if (!fields) { error(file, `frontmatter: ${reason}`); continue; }
  for (const k of Object.keys(fields)) if (!SPEC.ruleFields.includes(k)) error(file, `frontmatter: unknown field "${k}" (rules only take "paths")`);
}

// --- Hooks in settings.json and hooks.json --------------------------------------
function checkHooksConfig(file, hooks, pathVar) {
  if (!hooks || typeof hooks !== "object") return;
  for (const [event, groups] of Object.entries(hooks)) {
    if (!SPEC.hookEvents.includes(event)) error(file, `hooks: unknown event "${event}"`);
    if (!Array.isArray(groups)) { error(file, `hooks.${event}: must be an array of matcher groups`); continue; }
    for (const group of groups) {
      for (const h of group.hooks ?? []) {
        if (!SPEC.hookTypes.includes(h.type)) error(file, `hooks.${event}: unknown handler type "${h.type}"`);
        for (const k of Object.keys(h)) if (!SPEC.hookHandlerFields.includes(k)) warn(file, `hooks.${event}: handler field "${k}" is not in the documented hook schema`);
        const cmd = String(h.command ?? "");
        for (const v of SPEC.legacyHookEnvVars) if (cmd.includes(v)) error(file, `hooks.${event}: "${v}" is not part of the hook contract (hooks read JSON on stdin)`);
        const m = cmd.match(/\.claude\/hooks\/([\w.-]+\.sh)/);
        if (m && !existsSync(join(root, ".claude", "hooks", m[1]))) error(file, `hooks.${event}: references missing script .claude/hooks/${m[1]}`);
        if (pathVar && m && !cmd.includes(pathVar)) warn(file, `hooks.${event}: command should reference the script through ${pathVar} so it works from worktrees and plugin installs`);
      }
    }
  }
}
const settingsFile = join(root, ".claude", "settings.json");
if (existsSync(settingsFile)) {
  try { checkHooksConfig(settingsFile, JSON.parse(readFileSync(settingsFile, "utf8")).hooks, "CLAUDE_PROJECT_DIR"); }
  catch (e) { error(settingsFile, `invalid JSON: ${e.message}`); }
}
const hooksJson = join(root, ".claude", "hooks", "hooks.json");
if (existsSync(hooksJson)) {
  try { checkHooksConfig(hooksJson, JSON.parse(readFileSync(hooksJson, "utf8")).hooks, "CLAUDE_PLUGIN_ROOT"); }
  catch (e) { error(hooksJson, `invalid JSON: ${e.message}`); }
}

// --- Hook scripts ----------------------------------------------------------------
const hooksDir = join(root, ".claude", "hooks");
if (existsSync(hooksDir)) {
  for (const f of readdirSync(hooksDir).filter((n) => n.endsWith(".sh"))) {
    const file = join(hooksDir, f);
    const text = readFileSync(file, "utf8");
    if (/TOOL_INPUT="\$\{1/.test(text) || /TOOL_OUTPUT="\$\{2/.test(text)) error(file, "reads TOOL_INPUT/TOOL_OUTPUT from positional args; the hook contract is JSON on stdin (source lib/hook-io.sh)");
    // A hook that execs another hook script hands it stdin, event JSON included.
    else if (!/hook_read_input|\bcat\b|jq\s|exec\s+bash\s+"\$HOOK_DIR\//.test(text)) warn(file, "does not appear to read the event JSON from stdin");
    if (!/trap 'exit 0' ERR/.test(text)) warn(file, "missing the defensive `trap 'exit 0' ERR` guard");
  }
}

// --- Plugin manifest ----------------------------------------------------------------
const manifest = join(root, ".claude-plugin", "plugin.json");
if (existsSync(manifest)) {
  try {
    const m = JSON.parse(readFileSync(manifest, "utf8"));
    if (!m.name || !/^[a-z0-9][a-z0-9-]*$/.test(m.name)) error(manifest, 'name is required and must be kebab-case');
    for (const k of Object.keys(m)) if (!SPEC.pluginManifestFields.includes(k)) warn(manifest, `unknown manifest field "${k}"`);
    for (const k of ["agents", "skills", "commands", "hooks", "outputStyles", "workflows", "mcpServers", "lspServers"]) {
      const v = m[k];
      if (v == null || typeof v === "object" && !Array.isArray(v)) continue;
      for (const p of Array.isArray(v) ? v : [v]) {
        if (typeof p !== "string") continue;
        if (!p.startsWith("./") && p !== ".") error(manifest, `${k}: path "${p}" must start with ./`);
        else if (!existsSync(join(root, p))) error(manifest, `${k}: path "${p}" does not exist`);
      }
    }
  } catch (e) { error(manifest, `invalid JSON: ${e.message}`); }
}

// --- Live docs naming retired tools --------------------------------------------------
// plans, rfcs, research and audits are dated records of a past decision: they may name
// a retired tool in context and are never rewritten (check-doc-counts skips them too).
const SKIP_DIRS = new Set([".git", "node_modules", "plans", "rfcs", "research", "audits", "fixtures"]);
const isDoc = (p) => p.endsWith(".md") && !/^(CHANGELOG|RELEASE_NOTES)\.md$/.test(basename(p));
// In a git repo, list what git sees (tracked plus untracked-but-not-ignored), so build
// output, browser profiles, and other ignored local state are never walked.
function gitMd() {
  try {
    const out = execFileSync("git", ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024 });
    return out.split("\0").filter((rel) => rel && isDoc(rel) && !rel.split("/").slice(0, -1).some((d) => SKIP_DIRS.has(d))).map((rel) => join(root, rel)).filter((p) => existsSync(p));
  } catch { return null; }
}
// Outside git: walk the tree with lstat, so symlinks (Chrome profile locks …) are skipped, never followed.
function walkMd(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = lstatSync(p);
    if (st.isDirectory()) { if (!SKIP_DIRS.has(n)) walkMd(p, out); }
    else if (st.isFile() && isDoc(p)) out.push(p);
  }
  return out;
}
// Only backticked names or "<Name> tool" phrasing count; prose like "Google Tasks" does not.
const retiredNames = Object.keys(SPEC.retiredTools).join("|");
const retiredRe = new RegExp(`\`(${retiredNames})\`|\\b(${retiredNames}) tool\\b|^\\s*tools:.*\\b(${retiredNames})\\b`);
for (const file of gitMd() ?? walkMd(root)) {
  if (file.startsWith(agentsDir) || file.startsWith(skillsDir) || file.startsWith(commandsDir) || file.startsWith(join(root, "content"))) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const m = line.match(retiredRe);
    if (m && !/retired|removed|renamed|never use|no longer|instead of|legacy|replaces|replaced|is gone|was `|→|->/i.test(line)) warn(file, `line ${i + 1}: names retired tool "${m[1] || m[2] || m[3]}"`);
  });
}

// --- Plugin manifest agents list in sync with .claude/agents/ -------------------
// Agents named in metadata.excludedAgents stay in the repo but out of the plugin
// (Claude Code ignores `metadata`); every other agent must be listed.
if (existsSync(manifest)) {
  try {
    const m = JSON.parse(readFileSync(manifest, "utf8"));
    if (Array.isArray(m.agents)) {
      const listed = new Set(m.agents.map((p) => basename(String(p), ".md")));
      const excluded = new Set(Array.isArray(m.metadata?.excludedAgents) ? m.metadata.excludedAgents.map(String) : []);
      for (const a of agentNames) if (!listed.has(a) && !excluded.has(a)) error(manifest, `agents: .claude/agents/${a}.md is not listed (regenerate the list)`);
      for (const l of listed) if (!agentNames.has(l)) error(manifest, `agents: lists ${l}.md, which is not in .claude/agents/`);
      for (const x of excluded) {
        if (listed.has(x)) error(manifest, `agents: lists ${x}.md, which metadata.excludedAgents keeps out of the plugin`);
        if (!agentNames.has(x)) warn(manifest, `metadata.excludedAgents names ${x}, which is not in .claude/agents/`);
      }
    }
  } catch { /* reported above */ }
}

// --- Report ------------------------------------------------------------------------------
const errors = findings.filter((f) => f.severity === "error");
const warnings = findings.filter((f) => f.severity === "warning");
const ok = errors.length === 0 && (!strict || warnings.length === 0);
if (json) {
  process.stdout.write(JSON.stringify({ ok, verifiedAgainst: SPEC.verifiedAgainst, agents: agentNames.size, skills: skillNames.size, errors: errors.length, warnings: warnings.length, findings }, null, 2) + "\n");
} else {
  process.stdout.write(`Claude Code conformance (spec verified against ${SPEC.verifiedAgainst.claudeCodeVersion}, ${SPEC.verifiedAgainst.date})\n`);
  process.stdout.write(`  ${agentNames.size} agents, ${skillNames.size} skills checked\n`);
  for (const f of findings) process.stdout.write(`  ${f.severity === "error" ? "✗" : "⚠"} ${f.file}: ${f.message}\n`);
  process.stdout.write(`\n${errors.length} error(s), ${warnings.length} warning(s)${ok ? " — OK" : ""}\n`);
}
process.exit(ok ? 0 : 1);
