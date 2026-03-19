# Backport from Coding Framework — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Backport 25 generic agents, 6 PostToolUse hooks, and 5 scripts from the Coding Framework project into this WordPress template, adapting React/JS-specific references to WordPress where needed.

**Architecture:** Copy generic agents as-is, adapt 3 agents for WordPress context, translate JS-centric hooks to WordPress equivalents, and convert 1 script from JS tooling to PHP tooling. Documentation updates last.

**Tech Stack:** Bash hooks, Node.js scripts (pixelmatch/Playwright), PHP tooling (Psalm/PHPStan), WordPress CLI

---

## Section 1: Agents — Copy As-Is (22 agents)

These agents are framework-agnostic and need no adaptation.

### Task 1: Copy Meta/Ops agents (7 files)

**Files:**
- Copy: `{source}/.claude/agents/agent-expert.md` → `.claude/agents/agent-expert.md`
- Copy: `{source}/.claude/agents/command-expert.md` → `.claude/agents/command-expert.md`
- Copy: `{source}/.claude/agents/studio-coach.md` → `.claude/agents/studio-coach.md`
- Copy: `{source}/.claude/agents/studio-producer.md` → `.claude/agents/studio-producer.md`
- Copy: `{source}/.claude/agents/project-shipper.md` → `.claude/agents/project-shipper.md`
- Copy: `{source}/.claude/agents/sprint-prioritizer.md` → `.claude/agents/sprint-prioritizer.md`
- Copy: `{source}/.claude/agents/experiment-tracker.md` → `.claude/agents/experiment-tracker.md`

**Source:** `C:\Users\Paul Mulligan\PMDS\Projects\Coding Framework`

**Step 1:** Read each source file and write to destination.
**Step 2:** Verify all 7 files exist in `.claude/agents/`.

**Adaptation:** None

---

### Task 2: Copy Business agents (5 files)

**Files:**
- Copy: `{source}/.claude/agents/brand-guardian.md` → `.claude/agents/brand-guardian.md`
- Copy: `{source}/.claude/agents/finance-tracker.md` → `.claude/agents/finance-tracker.md`
- Copy: `{source}/.claude/agents/legal-compliance-checker.md` → `.claude/agents/legal-compliance-checker.md`
- Copy: `{source}/.claude/agents/support-responder.md` → `.claude/agents/support-responder.md`
- Copy: `{source}/.claude/agents/feedback-synthesizer.md` → `.claude/agents/feedback-synthesizer.md`

**Step 1:** Read each source file and write to destination.
**Step 2:** Verify all 5 files exist.

**Adaptation:** None

---

### Task 3: Copy Marketing/Social agents (7 files)

**Files:**
- Copy: `{source}/.claude/agents/content-creator.md` → `.claude/agents/content-creator.md`
- Copy: `{source}/.claude/agents/growth-hacker.md` → `.claude/agents/growth-hacker.md`
- Copy: `{source}/.claude/agents/instagram-curator.md` → `.claude/agents/instagram-curator.md`
- Copy: `{source}/.claude/agents/reddit-community-builder.md` → `.claude/agents/reddit-community-builder.md`
- Copy: `{source}/.claude/agents/tiktok-strategist.md` → `.claude/agents/tiktok-strategist.md`
- Copy: `{source}/.claude/agents/twitter-engager.md` → `.claude/agents/twitter-engager.md`
- Copy: `{source}/.claude/agents/visual-storyteller.md` → `.claude/agents/visual-storyteller.md`
- Copy: `{source}/.claude/agents/trend-researcher.md` → `.claude/agents/trend-researcher.md`

**Step 1:** Read each source file and write to destination.
**Step 2:** Verify all 8 files exist.

**Adaptation:** None

---

### Task 4: Copy Engineering agents (3 files)

**Files:**
- Copy: `{source}/.claude/agents/devops-automator.md` → `.claude/agents/devops-automator.md`
- Copy: `{source}/.claude/agents/infrastructure-maintainer.md` → `.claude/agents/infrastructure-maintainer.md`
- Copy: `{source}/.claude/agents/tool-evaluator.md` → `.claude/agents/tool-evaluator.md`

**Step 1:** Read each source file and write to destination.
**Step 2:** Verify all 3 files exist.

**Adaptation:** None

---

### Task 5: Copy Joker agent (1 file)

**Files:**
- Copy: `{source}/.claude/agents/joker.md` → `.claude/agents/joker.md`

**Step 1:** Read source file and write to destination.

**Adaptation:** None

---

## Section 2: Agents — Copy and Adapt (3 agents)

### Task 6: Adapt ai-engineer.md

**Files:**
- Source: `{source}/.claude/agents/ai-engineer.md`
- Create: `.claude/agents/ai-engineer.md`

**Adaptation:** Minor
- Remove any React-specific UI integration patterns (there are none in the current source — it's already generic)
- Keep all LLM, ML pipeline, recommendation, vision, and infrastructure sections as-is
- The source agent is already framework-agnostic, so this is effectively a copy

**Step 1:** Read source, verify no React-specific patterns, write to destination as-is.

---

### Task 7: Adapt backend-architect.md

**Files:**
- Source: `{source}/.claude/agents/backend-architect.md`
- Create: `.claude/agents/backend-architect.md`

**Adaptation:** Minor
- Add WordPress-specific backend context to the description and body:
  - In description: append "including WordPress plugin architecture, REST API endpoints, and custom post types"
  - In the "API Design" section: add "WordPress REST API (register_rest_route, custom endpoints)" alongside RESTful/GraphQL
  - In "Database Architecture" section: add "$wpdb, WP_Query, custom tables with dbDelta()" alongside SQL/NoSQL
  - In "Security Implementation" section: add "WordPress nonces (wp_nonce_field, wp_verify_nonce), capability checks (current_user_can)" alongside JWT/OAuth2
  - In "Technology Stack Expertise": add "PHP, WordPress" to Languages, "WordPress REST API" to Frameworks

**Step 1:** Read source file.
**Step 2:** Make the 5 additions noted above.
**Step 3:** Write adapted file to destination.

---

### Task 8: Adapt migration-specialist.md

**Files:**
- Source: `{source}/.claude/agents/migration-specialist.md`
- Create: `.claude/agents/migration-specialist.md`

**Adaptation:** Significant
- Rewrite description: "Use this agent when upgrading WordPress versions, migrating PHP versions, updating major plugins, switching hosting environments, converting classic themes to FSE block themes, or handling breaking changes in WordPress updates."
- Replace framework migration examples:
  - "CRA → Vite" → "Classic Theme → FSE Block Theme"
  - "Pages Router → App Router" → "Classic Editor → Block Editor (Gutenberg)"
  - "React version upgrades" → "WordPress major version upgrades (6.x → 7.x)"
  - "Next.js version upgrades" → "PHP version upgrades (8.1 → 8.2 → 8.3)"
- Replace library migration examples:
  - "Redux → Zustand" → "Advanced Custom Fields → Native WordPress Meta / Custom Fields API"
  - "Axios → fetch" → "wp_remote_get → WordPress HTTP API best practices"
  - "Moment.js → date-fns" → "Legacy date functions → WordPress date_i18n / wp_date"
  - "Jest → Vitest" → "PHPUnit 9 → PHPUnit 10/11 with WordPress test suite"
  - "styled-components → Tailwind" → "Custom CSS → theme.json design tokens + block styles"
- Replace codemod references with WordPress equivalents:
  - "npx @next/codemod" → "wp-cli search-replace, rector for PHP"
  - "jscodeshift" → "Rector PHP (automated refactoring)"
- Update migration checklist:
  - Replace `grep -r "import.*from"` with `grep -r "require\|include\|use " themes/ plugins/`
  - Replace `package.json` with `composer.json`
  - Replace "bundle size" with "theme/plugin directory size"
  - Replace "Lighthouse on key pages" with "WordPress health check, coding standards scan"
- Update quality standards:
  - Replace "Bundle size delta" with "Plugin/theme size delta"
  - Replace "Performance benchmarks" with "WordPress Query Monitor benchmarks"

**Step 1:** Read source file.
**Step 2:** Rewrite with WordPress-specific migration patterns as noted.
**Step 3:** Write adapted file to destination.

---

### Task 9: Verify all 25 agents

**Step 1:** Run `ls .claude/agents/ | wc -l` — expect 45 files (20 existing + 25 new).
**Step 2:** Verify no duplicate filenames.

**Step 3: Commit**
```bash
git add .claude/agents/
git commit -m "feat: backport 25 agents from Coding Framework (22 as-is, 3 adapted for WordPress)"
```

---

## Section 3: PostToolUse Hooks (6 hooks)

### Task 10: Add 6 PostToolUse hooks to settings.json

**Files:**
- Modify: `.claude/settings.json`

**Current state:** Only has `PreToolUse` with 1 Write|Edit matcher. No `PostToolUse` section.

**Step 1:** Read current `.claude/settings.json`.

**Step 2:** Add a `PostToolUse` array alongside the existing `PreToolUse`. The final structure:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "./.claude/hooks/validate-theme-location.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'if echo \"$TOOL_INPUT\" | grep -q \"validate-theme\\|check-coding-standards\\|phpcs\" && echo \"$TOOL_OUTPUT\" | grep -qiE \"pass|success|no (errors|violations)\"; then echo \"[post-build-qa] Theme validation passed. Run full quality gate: ./scripts/wordpress/check-coding-standards.sh && ./scripts/wordpress/security-scan.sh && ./scripts/wordpress/check-performance.sh\"; fi'",
            "description": "Remind to run full quality gate after theme validation passes"
          },
          {
            "type": "command",
            "command": "bash -c 'if echo \"$TOOL_INPUT\" | grep -q \"git commit\"; then if [ -d themes ] || [ -d plugins ]; then for dir in themes/*/style.css; do THEME_DIR=$(dirname \"$dir\"); RESULT=$(grep -rn \"#[0-9a-fA-F]\\{3,8\\}\" \"$THEME_DIR/templates/\" \"$THEME_DIR/parts/\" \"$THEME_DIR/patterns/\" 2>/dev/null | grep -v \"theme.json\" | head -5); if [ -n \"$RESULT\" ]; then echo \"[pre-commit-guard] Hardcoded color values found. Use theme.json tokens instead:\"; echo \"$RESULT\"; fi; done; fi; fi'",
            "description": "Check for hardcoded design values that should use theme.json tokens before commits"
          },
          {
            "type": "command",
            "command": "bash -c 'if echo \"$TOOL_INPUT\" | grep -q \"phpunit\\|pest\" && echo \"$TOOL_OUTPUT\" | grep -qiE \"coverage|clover\"; then echo \"[coverage-check] Review coverage output above. Ensure theme/plugin coverage meets your target threshold (recommended: 80%).\"; fi'",
            "description": "Remind to check coverage threshold after PHPUnit/Pest runs with coverage"
          },
          {
            "type": "command",
            "command": "bash -c 'if echo \"$TOOL_INPUT\" | grep -q \"visual-diff.js\" && echo \"$TOOL_OUTPUT\" | grep -q \"PASS\"; then echo \"[dark-mode-reminder] Visual diff passed. Consider running dark mode verification: ./scripts/check-dark-mode.sh\"; fi'",
            "description": "Remind to run dark mode verification after visual diff passes"
          },
          {
            "type": "command",
            "command": "bash -c 'if echo \"$TOOL_INPUT\" | grep -q \"git commit\"; then MAX_THEME_KB=5120; MAX_PLUGIN_KB=10240; for dir in themes/*/; do if [ -d \"$dir\" ]; then SIZE_KB=$(du -sk \"$dir\" 2>/dev/null | cut -f1); if [ \"${SIZE_KB:-0}\" -gt \"$MAX_THEME_KB\" ]; then echo \"[bundle-guard] Theme $(basename $dir) is ${SIZE_KB}KB — exceeds ${MAX_THEME_KB}KB limit. Review for large assets.\"; fi; fi; done; for dir in plugins/*/; do if [ -d \"$dir\" ]; then SIZE_KB=$(du -sk \"$dir\" 2>/dev/null | cut -f1); if [ \"${SIZE_KB:-0}\" -gt \"$MAX_PLUGIN_KB\" ]; then echo \"[bundle-guard] Plugin $(basename $dir) is ${SIZE_KB}KB — exceeds ${MAX_PLUGIN_KB}KB limit.\"; fi; fi; done; fi'",
            "description": "Warn if theme (>5MB) or plugin (>10MB) directory size exceeds limits before commits"
          },
          {
            "type": "command",
            "command": "bash -c 'if echo \"$TOOL_INPUT\" | grep -qE \"phpunit|pest\" && echo \"$TOOL_OUTPUT\" | grep -qiE \"OK \\(|Tests:.*passed|All tests passed\"; then echo \"[mutation-test] All tests passed. Consider running PHP mutation testing to validate test quality: vendor/bin/infection --min-msi=70 --min-covered-msi=80\"; fi'",
            "description": "Suggest PHP mutation testing (Infection) after all tests pass"
          }
        ]
      }
    ]
  }
}
```

**Hook adaptations from source:**

| # | Source Hook | WordPress Adaptation | What Changed |
|---|-----------|---------------------|--------------|
| 1 | post-build-qa (pnpm build) | post-build-qa (theme validation) | Trigger: phpcs/validate-theme → quality gate scripts |
| 2 | pre-commit-guard (design-tokens.lock.json) | pre-commit-guard (hardcoded colors) | Scans templates/parts/patterns for hex values not in theme.json |
| 3 | coverage-check (vitest) | coverage-check (phpunit/pest) | Changed vitest → phpunit/pest, same 80% recommendation |
| 4 | dark-mode-reminder (visual-diff.js) | dark-mode-reminder (visual-diff.js) | Copied as-is — visual-diff.js is framework-agnostic |
| 5 | bundle-guard (.next/dist) | bundle-guard (themes/plugins dirs) | Changed from JS bundle to theme 5MB / plugin 10MB limits |
| 6 | mutation-test (stryker) | mutation-test (infection) | Changed npx stryker → vendor/bin/infection with MSI thresholds |

**Note:** Source hook #5 (lighthouse-ci) was NOT included per the backport spec (only 6 hooks requested). It's already covered by existing WordPress performance scripts.

**Step 3:** Write the merged settings.json.
**Step 4:** Validate JSON syntax with `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"`.

**Step 5: Commit**
```bash
git add .claude/settings.json
git commit -m "feat: add 6 PostToolUse hooks adapted for WordPress development"
```

---

## Section 4: Scripts (5 scripts)

### Task 11: Copy visual-diff.js

**Files:**
- Source: `{source}/scripts/visual-diff.js`
- Create: `scripts/visual-diff.js`

**Adaptation:** None — generic pixelmatch tool with no framework dependencies.

**Step 1:** Read source, write to destination.
**Step 2:** Verify: `head -1 scripts/visual-diff.js` shows `#!/usr/bin/env node`.

**Dependencies:** Requires `pngjs` and `pixelmatch` npm packages. Add note to docs.

---

### Task 12: Copy check-responsive.sh

**Files:**
- Source: `{source}/scripts/check-responsive.sh`
- Create: `scripts/check-responsive.sh`

**Adaptation:** Minor — change default URL from `http://localhost:3000` to `http://localhost:8080` (standard WordPress local dev port).

**Step 1:** Read source.
**Step 2:** Change line `URL="${1:-http://localhost:3000}"` → `URL="${1:-http://localhost:8080}"`.
**Step 3:** Write to destination, make executable (`chmod +x`).

---

### Task 13: Copy check-dark-mode.sh

**Files:**
- Source: `{source}/scripts/check-dark-mode.sh`
- Create: `scripts/check-dark-mode.sh`

**Adaptation:** Minor — change default URL from `http://localhost:3000` to `http://localhost:8080`.

**Step 1:** Read source.
**Step 2:** Change `URL="http://localhost:3000"` → `URL="http://localhost:8080"`.
**Step 3:** Write to destination, make executable.

**Dependency:** Requires `scripts/visual-diff.js` (Task 11) and light mode baselines.

---

### Task 14: Adapt check-dead-code.sh for PHP

**Files:**
- Source: `{source}/scripts/check-dead-code.sh`
- Create: `scripts/check-dead-code.sh`

**Adaptation:** Significant — replace knip (JS) with Psalm or PHPStan for PHP dead code detection.

**New script behavior:**
- Same interface: `--json` flag, same exit codes (0=clean, 1=dead code found)
- Use `vendor/bin/psalm --find-dead-code` as primary tool
- Fallback to `vendor/bin/phpstan analyse --level=5` if Psalm not available
- Auto-install via Composer if neither found
- Scan `themes/` and `plugins/` directories (not `src/`)
- Config read from `.claude/pipeline.config.json` if present (same `deadCode.enabled` check)

**Step 1:** Write the adapted script:

```bash
#!/usr/bin/env bash
# check-dead-code.sh — Detect unused code in PHP projects using Psalm or PHPStan
# Exit codes: 0=no dead code, 1=dead code found
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# --- Flags ---
JSON_OUTPUT=false

for arg in "$@"; do
  case "$arg" in
    --json)     JSON_OUTPUT=true ;;
    -h|--help)
      echo "Usage: check-dead-code.sh [--json]"
      echo "  --json   Output results as JSON (machine-parseable)"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg"
      exit 1
      ;;
  esac
done

# --- Check if dead code detection is enabled ---
CONFIG_FILE=".claude/pipeline.config.json"
ENABLED=true

if [[ -f "$CONFIG_FILE" ]] && command -v node &>/dev/null; then
  ENABLED=$(node -e "
    const fs = require('fs');
    try {
      const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
      console.log(config.deadCode?.enabled !== false ? 'true' : 'false');
    } catch (e) {
      console.log('true');
    }
  " 2>/dev/null || echo "true")
fi

if [[ "$ENABLED" == "false" ]]; then
  if $JSON_OUTPUT; then
    echo '{"status": "skipped", "reason": "deadCode.enabled is false in pipeline.config.json"}'
  else
    echo "Dead code detection is disabled in $CONFIG_FILE"
  fi
  exit 0
fi

if ! $JSON_OUTPUT; then
  echo "=== Dead Code Detection (PHP) ==="
  echo ""
fi

# --- Find PHP analysis tool ---
TOOL=""
if [[ -f vendor/bin/psalm ]]; then
  TOOL="psalm"
elif [[ -f vendor/bin/phpstan ]]; then
  TOOL="phpstan"
else
  if ! $JSON_OUTPUT; then
    echo "No PHP analysis tool found. Attempting to install Psalm..."
  fi
  composer require --dev vimeo/psalm 2>/dev/null || {
    if $JSON_OUTPUT; then
      echo '{"status": "error", "reason": "Failed to install Psalm. Run: composer require --dev vimeo/psalm"}'
    else
      echo "  Failed to install Psalm. Install manually: composer require --dev vimeo/psalm"
    fi
    exit 1
  }
  TOOL="psalm"
  if ! $JSON_OUTPUT; then
    echo "  Psalm installed"
    echo ""
  fi
fi

# --- Determine scan targets ---
SCAN_DIRS=""
[[ -d themes ]] && SCAN_DIRS="$SCAN_DIRS themes/"
[[ -d plugins ]] && SCAN_DIRS="$SCAN_DIRS plugins/"
[[ -d mu-plugins ]] && SCAN_DIRS="$SCAN_DIRS mu-plugins/"

if [[ -z "$SCAN_DIRS" ]]; then
  if $JSON_OUTPUT; then
    echo '{"status": "pass", "deadCodeFound": false, "reason": "No themes/, plugins/, or mu-plugins/ directories found"}'
  else
    echo "No PHP directories to scan (themes/, plugins/, mu-plugins/)"
  fi
  exit 0
fi

# --- Run analysis ---
RESULT_FILE=$(mktemp)
trap 'rm -f "$RESULT_FILE"' EXIT
ANALYSIS_EXIT=0

if ! $JSON_OUTPUT; then
  echo "Scanning for dead code with $TOOL..."
  echo "Directories: $SCAN_DIRS"
  echo ""
fi

if [[ "$TOOL" == "psalm" ]]; then
  vendor/bin/psalm --find-dead-code --no-cache $SCAN_DIRS > "$RESULT_FILE" 2>&1 || ANALYSIS_EXIT=$?
else
  vendor/bin/phpstan analyse --level=5 --error-format=table $SCAN_DIRS > "$RESULT_FILE" 2>&1 || ANALYSIS_EXIT=$?
fi

RESULT_OUTPUT=$(cat "$RESULT_FILE")

# --- Process output ---
if $JSON_OUTPUT; then
  if [[ $ANALYSIS_EXIT -eq 0 ]] || [[ -z "$RESULT_OUTPUT" ]]; then
    echo '{"status": "pass", "deadCodeFound": false, "tool": "'"$TOOL"'", "issues": []}'
    exit 0
  else
    echo "{\"status\": \"fail\", \"deadCodeFound\": true, \"tool\": \"$TOOL\", \"raw\": $(echo "$RESULT_OUTPUT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '""')}"
    exit 1
  fi
fi

# --- Human-readable output ---
if [[ $ANALYSIS_EXIT -eq 0 ]] || [[ -z "$RESULT_OUTPUT" ]]; then
  echo "=== Summary ==="
  echo "No dead code detected ($TOOL found no issues)"
  exit 0
fi

echo "$RESULT_OUTPUT" | sed 's/^/  /'
echo ""
echo "=== Summary ==="
echo "Dead code detected — review the output above"
echo "  Tool: $TOOL"
exit 1
```

**Step 2:** Make executable: `chmod +x scripts/check-dead-code.sh`.

---

### Task 15: Verify all 5 scripts

**Step 1:** Run `ls scripts/visual-diff.js scripts/check-responsive.sh scripts/check-dark-mode.sh scripts/check-dead-code.sh` — all 4 must exist.
**Step 2:** Run `bash -n scripts/check-responsive.sh && bash -n scripts/check-dark-mode.sh && bash -n scripts/check-dead-code.sh` — syntax check.
**Step 3:** Run `node --check scripts/visual-diff.js` — syntax check.

**Note:** check-responsive.sh appears twice in the spec. Both references point to the same file (Task 12 covers it). The 5th script is check-dead-code.sh.

**Step 4: Commit**
```bash
git add scripts/visual-diff.js scripts/check-responsive.sh scripts/check-dark-mode.sh scripts/check-dead-code.sh
git commit -m "feat: add 4 quality scripts (visual-diff, responsive, dark-mode, dead-code for PHP)"
```

---

## Section 5: Documentation Updates

### Task 16: Update CLAUDE.md

**File:** `CLAUDE.md`

**Changes:**
1. Update agent count: "20" → "45" everywhere it appears
2. Update "Custom Agents (20 Total)" heading → "Custom Agents (45 Total)"
3. Add new scripts to the script reference section:
   ```
   ### Visual QA & Quality Scripts
   ./scripts/visual-diff.js [actual] [expected]     # Pixel-level screenshot comparison
   ./scripts/check-responsive.sh [url]               # Responsive screenshots at all breakpoints
   ./scripts/check-dark-mode.sh [url]                # Dark mode visual verification
   ./scripts/check-dead-code.sh [--json]             # PHP dead code detection (Psalm/PHPStan)
   ```
4. Add hooks documentation:
   ```
   ### PostToolUse Hooks (6 Total)
   - post-build-qa — Reminds to run full quality gate after theme validation
   - pre-commit-guard — Checks for hardcoded colors before commits
   - coverage-check — Reminds to review PHPUnit/Pest coverage output
   - dark-mode-reminder — Suggests dark mode verification after visual diff
   - bundle-guard — Warns if theme >5MB or plugin >10MB before commits
   - mutation-test — Suggests Infection PHP after all tests pass
   ```
5. Update "Last Updated" date to 2026-03-18

---

### Task 17: Update CUSTOM-AGENTS-GUIDE.md

**File:** `.claude/CUSTOM-AGENTS-GUIDE.md`

**Changes:**
1. Update header: "Total Custom Agents: 20" → "Total Custom Agents: 45"
2. Update "Last Updated" to 2026-03-18
3. Add new section after existing sections:

```markdown
## Generic/Cross-Domain Agents (25 total)

These agents are domain-agnostic and useful across all project types.

### Meta/Ops (7)
| Agent | Purpose |
|-------|---------|
| agent-expert | Creating and designing specialized Claude Code agents |
| command-expert | Creating Claude Code slash commands |
| studio-coach | Development coaching and mentoring |
| studio-producer | Project production and coordination |
| project-shipper | Getting projects to release |
| sprint-prioritizer | Sprint planning and prioritization |
| experiment-tracker | Tracking A/B tests and experiments |

### Business (5)
| Agent | Purpose |
|-------|---------|
| brand-guardian | Brand consistency and guidelines |
| finance-tracker | Financial tracking and budgeting |
| legal-compliance-checker | Legal and compliance review |
| support-responder | Customer support responses |
| feedback-synthesizer | Synthesizing user feedback |

### Marketing/Social (8)
| Agent | Purpose |
|-------|---------|
| content-creator | Content creation and copywriting |
| growth-hacker | Growth strategies and experiments |
| instagram-curator | Instagram content strategy |
| reddit-community-builder | Reddit community engagement |
| tiktok-strategist | TikTok content strategy |
| twitter-engager | Twitter/X engagement |
| visual-storyteller | Visual content and storytelling |
| trend-researcher | Trend research and analysis |

### Engineering (4)
| Agent | Purpose |
|-------|---------|
| devops-automator | CI/CD, infrastructure automation |
| infrastructure-maintainer | Server and infrastructure maintenance |
| tool-evaluator | Evaluating development tools |
| joker | Tech humor and team morale |

### Adapted for WordPress (3)
| Agent | Purpose | Adaptation |
|-------|---------|------------|
| ai-engineer | AI/ML feature integration | Generic (no changes needed) |
| backend-architect | Backend architecture and APIs | Added WordPress REST API, $wpdb, nonces |
| migration-specialist | Version upgrades and migrations | Rewritten for WordPress/PHP migrations |
```

4. Update Quick Reference table with new agents
5. Update architecture status: "45 total"
6. Remove "Removed Agents" section entries for agents we're re-adding (brand-guardian, feedback-synthesizer, etc.)

---

### Task 18: Final verification and commit

**Step 1:** Run `ls .claude/agents/*.md | wc -l` — expect 45.
**Step 2:** Run `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); console.log('JSON valid')"`.
**Step 3:** Run `bash -n scripts/check-responsive.sh && bash -n scripts/check-dark-mode.sh && bash -n scripts/check-dead-code.sh && echo 'All scripts valid'`.

**Step 4: Commit docs**
```bash
git add CLAUDE.md .claude/CUSTOM-AGENTS-GUIDE.md
git commit -m "docs: update agent count, add hook and script documentation"
```

**Step 5: Squash into single commit (optional)**
If preferred, squash the 4 commits into one:
```bash
git reset --soft HEAD~4
git commit -m "feat: backport 25 agents, 6 hooks, and 5 scripts from Coding Framework"
```

---

## Dependency Graph

```
Tasks 1-5 (copy as-is agents) ──┐
Tasks 6-8 (adapt agents)  ──────┼──→ Task 9 (verify + commit agents)
                                 │
Task 10 (hooks) ─────────────────┼──→ (independent)
                                 │
Task 11 (visual-diff.js) ───────┤
Task 12 (check-responsive.sh) ──┼──→ Task 15 (verify + commit scripts)
Task 13 (check-dark-mode.sh) ───┤
Task 14 (check-dead-code.sh) ───┘
                                 │
All above ───────────────────────┴──→ Tasks 16-18 (docs + final commit)
```

**Parallelizable:** Tasks 1-5 can run in parallel. Tasks 6-8 can run in parallel. Task 10 is independent of Section 1/2. Tasks 11-14 can run in parallel.

**Sequential:** Task 9 depends on 1-8. Task 15 depends on 11-14. Tasks 16-18 depend on everything.

---

## Summary

| Section | Items | Effort |
|---------|-------|--------|
| Agents (as-is) | 22 files | Low — bulk copy |
| Agents (adapted) | 3 files | Medium — WordPress rewrite for migration-specialist |
| Hooks | 6 hooks in 1 file | Medium — WordPress-adapted bash one-liners |
| Scripts | 4 files (1 adapted) | Medium — PHP dead code script rewrite |
| Documentation | 2 files | Low — count updates and new sections |
| **Total** | **32 new/modified files** | |
