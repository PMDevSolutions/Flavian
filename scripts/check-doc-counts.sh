#!/usr/bin/env bash
# check-doc-counts.sh — Flag documentation drift in agent/skill counts.
#
# Counts the real entries on disk:
#   agents  → *.md files in .claude/agents/ (excluding README)
#   skills  → subdirectories of .claude/skills/ that contain a SKILL.md
#
# Then scans the live Markdown docs for any "N agents" / "N skills" claim and
# fails if a claim disagrees with the on-disk count. Historical and generated
# records are excluded on purpose, because they describe a past state and must
# not be rewritten: CHANGELOG.md, RELEASE_NOTES.md, docs/plans/, docs/audits/,
# docs/rfcs/, .claude/research/, archive/. WordPress code under themes/,
# plugins/, mu-plugins/ and wp-content/ is not documentation of this repo and
# is skipped too.
#
# Ported from PMDevSolutions/Maecenas (scripts/check-doc-counts.sh) on
# 2026-11-02 as a standalone script; bash 3.2 compatible.
#
# Usage:
#   ./scripts/check-doc-counts.sh                 # human-readable report, exit 1 on drift
#   ./scripts/check-doc-counts.sh --json          # machine-readable output
#   ./scripts/check-doc-counts.sh --root <dir>    # check another checkout (tests use this)
#
# Exit codes: 0 = in sync, 1 = drift detected, 2 = usage/IO error.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JSON=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) JSON=1 ;;
    --root)
      ROOT="$(cd "${2:-}" 2>/dev/null && pwd)" || { echo "No such directory: ${2:-}" >&2; exit 2; }
      shift ;;
    -h|--help)
      awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "${BASH_SOURCE[0]}"
      exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

cd "$ROOT"

# --- Count entries on disk ------------------------------------------------

agent_count=0
if [[ -d .claude/agents ]]; then
  while IFS= read -r f; do
    case "$(basename "$f")" in [Rr][Ee][Aa][Dd][Mm][Ee].md) continue ;; esac
    agent_count=$((agent_count + 1))
  done < <(find .claude/agents -maxdepth 1 -type f -name '*.md')
fi

skill_count=0
if [[ -d .claude/skills ]]; then
  while IFS= read -r d; do
    [[ -f "$d/SKILL.md" ]] && skill_count=$((skill_count + 1))
  done < <(find .claude/skills -mindepth 1 -maxdepth 1 -type d)
fi

# --- Scan docs for count claims -------------------------------------------
#
# A "claim" is a number next to the PLURAL word "agents" or "skills", in one of
# three forms (the plural keeps "Phase 4 agent" and "3 scripts per agent" out):
#   A: "<N> [adj]{0,3} agents"        e.g. "53 custom agents", "16 skills"
#   B: "Agents (<N> Total)"           e.g. "Skills (16 Total)"
#   C: "Total Agents:** <N>"          e.g. "**Total Skills:** 16"
# "7 of the agents" is a fraction, not a count, and is skipped.

COMBINED='[0-9]+( +[a-z][a-z./+-]*){0,3} +(agents|skills)'
COMBINED+='|(agents|skills) *\(?[0-9]+ +total'
COMBINED+='|total +(agents|skills)[^0-9]{0,8}[0-9]+'

DRIFT_LINES=()
while IFS= read -r match; do
  [[ -z "$match" ]] && continue
  file="${match%%:*}"; rest="${match#*:}"
  lineno="${rest%%:*}"; text="${rest#*:}"
  case "$text" in *" of "*|*" Of "*) continue ;; esac
  num="${text//[!0-9]/}"
  [[ -z "$num" ]] && continue
  case "$text" in
    *[aA][gG][eE][nN][tT]*) noun="agents"; expected="$agent_count" ;;
    *[sS][kK][iI][lL][lL]*) noun="skills"; expected="$skill_count" ;;
    *) continue ;;
  esac
  if [[ "$num" != "$expected" ]]; then
    squished="${text//$'\t'/ }"
    while [[ "$squished" == *"  "* ]]; do squished="${squished//  / }"; done
    DRIFT_LINES+=("${file#./}:${lineno}: claims ${num} ${noun}, expected ${expected} -> \"${squished}\"")
  fi
done < <(grep -riInoE "$COMBINED" \
  --include='*.md' \
  --exclude='CHANGELOG.md' \
  --exclude='RELEASE_NOTES.md' \
  --exclude-dir='.git' \
  --exclude-dir='node_modules' \
  --exclude-dir='vendor' \
  --exclude-dir='dist' \
  --exclude-dir='build' \
  --exclude-dir='.superpowers' \
  --exclude-dir='plans' \
  --exclude-dir='audits' \
  --exclude-dir='rfcs' \
  --exclude-dir='research' \
  --exclude-dir='archive' \
  --exclude-dir='raw' \
  --exclude-dir='results' \
  --exclude-dir='themes' \
  --exclude-dir='plugins' \
  --exclude-dir='mu-plugins' \
  --exclude-dir='wp-content' \
  . 2>/dev/null || true)

# A claim can match more than one form; de-duplicate before counting.
if ((${#DRIFT_LINES[@]})); then
  DEDUPED=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && DEDUPED+=("$line")
  done < <(printf '%s\n' "${DRIFT_LINES[@]}" | sort -u)
  DRIFT_LINES=("${DEDUPED[@]}")
fi
DRIFT=${#DRIFT_LINES[@]}

# --- Report ---------------------------------------------------------------

if [[ "$JSON" -eq 1 ]]; then
  printf '{\n'
  printf '  "agents": %d,\n' "$agent_count"
  printf '  "skills": %d,\n' "$skill_count"
  printf '  "drift": %d,\n' "$DRIFT"
  printf '  "violations": ['
  if ((${#DRIFT_LINES[@]})); then
    printf '\n'
    for i in "${!DRIFT_LINES[@]}"; do
      esc="${DRIFT_LINES[$i]//\\/\\\\}"; esc="${esc//\"/\\\"}"
      printf '    "%s"' "$esc"
      [[ "$i" -lt $((${#DRIFT_LINES[@]} - 1)) ]] && printf ','
      printf '\n'
    done
    printf '  '
  fi
  printf ']\n}\n'
else
  echo "Documentation count check"
  echo "  On disk: ${agent_count} agents, ${skill_count} skills"
  if [[ "$DRIFT" -eq 0 ]]; then
    echo "  OK: every agent/skill count in the live docs matches the entries on disk"
  else
    echo "  ${DRIFT} documentation count(s) drifted from disk:"
    for line in "${DRIFT_LINES[@]}"; do
      echo "    ${line}"
    done
    echo ""
    echo "  Fix the counts above (CLAUDE.md, README.md, .claude/*.md, .claude/skills/README.md), or re-run after adding or removing agents or skills."
  fi
fi

[[ "$DRIFT" -eq 0 ]] || exit 1
