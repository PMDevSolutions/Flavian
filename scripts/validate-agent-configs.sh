#!/usr/bin/env bash
# validate-agent-configs.sh — Validate .claude/ agent, skill, and settings configurations
# Exit codes: 0 = valid, 1 = errors found

set -euo pipefail

ERRORS=0
WARNINGS=0

error() {
  echo "❌ $1: $2"
  ERRORS=$((ERRORS + 1))
}

warning() {
  echo "⚠️  $1: $2"
  WARNINGS=$((WARNINGS + 1))
}

# Extract YAML frontmatter (between first and second ---) from a file
extract_frontmatter() {
  local file="$1"
  sed -n '/^---$/,/^---$/p' "$file" | sed '1d;$d'
}

# Get a simple scalar field value from frontmatter text
get_field() {
  local frontmatter="$1"
  local field="$2"
  echo "$frontmatter" | grep -m1 "^${field}:" | sed "s/^${field}:[[:space:]]*//" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/"
}

# Validate a single agent .md file
validate_agent() {
  local file="$1"
  local filename
  filename=$(basename "$file")
  local local_errors=0

  # Check for YAML frontmatter
  local first_line
  first_line=$(head -1 "$file")
  if [[ "$first_line" != "---" ]]; then
    error "$filename" "missing YAML frontmatter"
    return 1
  fi

  local fm
  fm=$(extract_frontmatter "$file")

  # Required: name
  local name
  name=$(get_field "$fm" "name")
  if [[ -z "$name" ]]; then
    error "$filename" "missing required field: name"
    local_errors=$((local_errors + 1))
  fi

  # Required: description
  local desc
  desc=$(get_field "$fm" "description")
  if [[ -z "$desc" ]]; then
    error "$filename" "missing required field: description"
    local_errors=$((local_errors + 1))
  fi

  # Optional: model validation
  local model
  model=$(get_field "$fm" "model")
  if [[ -n "$model" ]]; then
    case "$model" in
      opus|sonnet|haiku) ;;
      *) error "$filename" "invalid model: $model (must be opus, sonnet, or haiku)"
         local_errors=$((local_errors + 1)) ;;
    esac
  fi

  # Optional: permissionMode validation
  local perm
  perm=$(get_field "$fm" "permissionMode")
  if [[ -n "$perm" ]]; then
    if [[ "$perm" != "bypassPermissions" ]]; then
      error "$filename" "invalid permissionMode: $perm (must be bypassPermissions)"
      local_errors=$((local_errors + 1))
    fi
  fi

  # Hook command validation: extract command fields and check file paths
  local commands
  commands=$(echo "$fm" | grep "^[[:space:]]\+command:" | sed 's/^[[:space:]]*command:[[:space:]]*//' | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")

  while IFS= read -r cmd; do
    [[ -z "$cmd" ]] && continue
    # Only check paths starting with ./ or /
    if [[ "$cmd" == ./* || "$cmd" == /* ]]; then
      # Strip leading ./ for file existence check
      local check_path="$cmd"
      if [[ "$cmd" == ./* ]]; then
        check_path="${cmd#./}"
      fi
      if [[ ! -f "$check_path" ]]; then
        error "$filename" "hook script not found: $cmd"
        local_errors=$((local_errors + 1))
      fi
    fi
  done <<< "$commands"

  return $local_errors
}

# Validate a single skill .md file
validate_skill() {
  local file="$1"
  local filename
  filename=$(basename "$file")
  local local_errors=0

  # Check for YAML frontmatter
  local first_line
  first_line=$(head -1 "$file")
  if [[ "$first_line" != "---" ]]; then
    error "$filename" "missing YAML frontmatter"
    return 1
  fi

  local fm
  fm=$(extract_frontmatter "$file")

  # Required: name
  local name
  name=$(get_field "$fm" "name")
  if [[ -z "$name" ]]; then
    error "$filename" "missing required field: name"
    local_errors=$((local_errors + 1))
  fi

  # Required: description
  local desc
  desc=$(get_field "$fm" "description")
  if [[ -z "$desc" ]]; then
    error "$filename" "missing required field: description"
    local_errors=$((local_errors + 1))
  fi

  return $local_errors
}

# Validate a settings JSON file
validate_settings() {
  local file="$1"
  local filename
  filename=$(basename "$file")

  # Check valid JSON
  if ! jq empty "$file" 2>/dev/null; then
    error "$filename" "invalid JSON"
    return 1
  fi

  local local_errors=0
  local valid_hook_types="PreToolUse PostToolUse Stop SubagentStart"

  # Iterate over hook type keys
  local hook_types
  hook_types=$(jq -r '.hooks // {} | keys[]' "$file" 2>/dev/null)

  while IFS= read -r hook_type; do
    [[ -z "$hook_type" ]] && continue

    # Check for unknown hook types
    local known=false
    for valid in $valid_hook_types; do
      if [[ "$hook_type" == "$valid" ]]; then
        known=true
        break
      fi
    done
    if [[ "$known" == "false" ]]; then
      warning "$filename" "unknown hook type: $hook_type"
    fi

    # Check each entry has a matcher field
    local count
    count=$(jq -r ".hooks.\"$hook_type\" | length" "$file" 2>/dev/null)
    for ((i = 0; i < count; i++)); do
      local matcher
      matcher=$(jq -r ".hooks.\"$hook_type\"[$i].matcher // empty" "$file" 2>/dev/null)
      if [[ -z "$matcher" ]]; then
        error "$filename" "missing required field: matcher in hooks.$hook_type[$i]"
        local_errors=$((local_errors + 1))
      fi
    done
  done <<< "$hook_types"

  return $local_errors
}

# Print summary and exit
print_summary() {
  echo ""
  if [[ $ERRORS -eq 0 ]]; then
    echo "✅ Validation passed ($WARNINGS warning(s))"
    exit 0
  else
    echo "❌ Validation failed: $ERRORS error(s), $WARNINGS warning(s)"
    exit 1
  fi
}

# ---- CLI argument parsing ----

MODE=""
AGENTS_DIR=""
SKILLS_DIR=""
TARGET_FILE=""
SETTINGS_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agents-dir)
      MODE="agent"
      AGENTS_DIR="$2"
      shift 2
      ;;
    --skills-dir)
      MODE="skill"
      SKILLS_DIR="$2"
      shift 2
      ;;
    --file)
      TARGET_FILE="$2"
      shift 2
      ;;
    --settings)
      MODE="settings"
      SETTINGS_FILE="$2"
      shift 2
      ;;
    --dry-run)
      MODE="full"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# Default mode is full project validation
if [[ -z "$MODE" ]]; then
  MODE="full"
fi

case "$MODE" in
  agent)
    if [[ -z "$TARGET_FILE" ]]; then
      echo "Error: --agents-dir requires --file" >&2
      exit 1
    fi
    validate_agent "$AGENTS_DIR/$TARGET_FILE" || true
    print_summary
    ;;

  skill)
    if [[ -z "$TARGET_FILE" ]]; then
      echo "Error: --skills-dir requires --file" >&2
      exit 1
    fi
    validate_skill "$SKILLS_DIR/$TARGET_FILE" || true
    print_summary
    ;;

  settings)
    validate_settings "$SETTINGS_FILE" || true
    print_summary
    ;;

  full)
    echo "Validating project configurations..."
    echo ""

    # Validate all agents
    if [[ -d .claude/agents ]]; then
      echo "--- Agents ---"
      declare -A agent_names
      for f in .claude/agents/*.md; do
        [[ -f "$f" ]] || continue
        validate_agent "$f" || true

        # Track names for duplicate detection
        local_fm=$(extract_frontmatter "$f")
        local_name=$(get_field "$local_fm" "name")
        if [[ -n "$local_name" ]]; then
          if [[ -n "${agent_names[$local_name]+x}" ]]; then
            error "$(basename "$f")" "duplicate agent name: $local_name (also in ${agent_names[$local_name]})"
          else
            agent_names[$local_name]=$(basename "$f")
          fi
        fi
      done
      echo ""
    fi

    # Validate all skills (SKILL.md or skill.md)
    if [[ -d .claude/skills ]]; then
      echo "--- Skills ---"
      for f in .claude/skills/*/SKILL.md .claude/skills/*/skill.md; do
        [[ -f "$f" ]] || continue
        validate_skill "$f" || true
      done
      echo ""
    fi

    # Validate settings files
    echo "--- Settings ---"
    for f in .claude/settings.json .claude/settings.local.json; do
      if [[ -f "$f" ]]; then
        validate_settings "$f" || true
      fi
    done

    print_summary
    ;;
esac
