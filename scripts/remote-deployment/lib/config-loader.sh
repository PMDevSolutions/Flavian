#!/usr/bin/env bash
# Loads a YAML environment configuration file and exports its contents as
# DEPLOY_CFG_* environment variables for the rest of the deployment pipeline.
#
# Configurations live in `.claude/config/deployment/<env>.yml`. See the example
# files in that directory for the full schema.

# shellcheck source=lib/common.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

PYTHON_BIN=""
if python3 --version >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif python --version >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

# Locate the config file for the named environment (staging/production/...).
# Honours $DEPLOY_CONFIG_DIR for non-default locations.
resolve_config_path() {
  local env_name="$1"
  local config_dir="${DEPLOY_CONFIG_DIR:-$PROJECT_ROOT/.claude/config/deployment}"
  local path="$config_dir/$env_name.yml"
  if [[ ! -f "$path" ]]; then
    path="$config_dir/$env_name.yaml"
  fi
  if [[ ! -f "$path" ]]; then
    log_error "Configuration not found for environment '$env_name' in $config_dir"
    log_error "Copy $config_dir/${env_name}.example.yml to ${env_name}.yml and edit."
    return 1
  fi
  printf '%s' "$path"
}

# Parse YAML using PyYAML when available, otherwise a shallow native fallback
# that handles the documented schema (no anchors, no flow-style mappings).
_parse_yaml_python() {
  local file="$1"
  "$PYTHON_BIN" - "$file" <<'PY'
import os
import sys
try:
    import yaml
except ImportError:
    sys.stderr.write("[ERROR] PyYAML not installed; falling back to native parser\n")
    sys.exit(2)

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    data = yaml.safe_load(fh) or {}

def emit(prefix, value):
    if isinstance(value, dict):
        for key, child in value.items():
            emit(f"{prefix}_{key.upper()}" if prefix else key.upper(), child)
    elif isinstance(value, list):
        joined = ",".join(str(item) for item in value)
        print(f"DEPLOY_CFG_{prefix}={joined}")
    else:
        rendered = "" if value is None else str(value)
        rendered = rendered.replace("\\", "\\\\").replace('"', '\\"')
        print(f'DEPLOY_CFG_{prefix}="{rendered}"')

emit("", data)
PY
}

# Native fallback: only handles two-space indentation, scalar values, and inline
# comma lists. Sufficient for the example config schema we ship.
_parse_yaml_native() {
  local file="$1"
  awk '
    function trim(s) { gsub(/^[ \t\r]+|[ \t\r]+$/, "", s); return s }
    function emit(key, value) {
      gsub(/\\/, "\\\\", value)
      gsub(/"/, "\\\"", value)
      printf("DEPLOY_CFG_%s=\"%s\"\n", toupper(key), value)
    }
    BEGIN { depth = 0 }
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*$/ { next }
    {
      line = $0
      sub(/[[:space:]]*#.*$/, "", line)
      indent = match(line, /[^ ]/) - 1
      level = int(indent / 2)
      while (depth > level) { depth--; delete stack[depth] }
      key = line; sub(/:.*$/, "", key); key = trim(key)
      value = line; sub(/^[^:]*:/, "", value); value = trim(value)
      stack[level] = key
      depth = level + 1
      if (value == "" || value == "{}" || value == "[]") next
      gsub(/^"|"$|^'\''|'\''$/, "", value)
      full = ""
      for (i = 0; i < depth; i++) {
        if (full == "") full = stack[i]
        else full = full "_" stack[i]
      }
      emit(full, value)
    }
  ' "$file"
}

# Public entry point. Sources parsed values into the current shell, prefixed
# with DEPLOY_CFG_<PATH_TO_KEY>.
load_environment_config() {
  local env_name="$1"
  local path
  path="$(resolve_config_path "$env_name")" || return 1

  log_info "Loading config: $path"

  local rendered=""
  local mode="native"
  if [[ -n "$PYTHON_BIN" ]]; then
    rendered="$(_parse_yaml_python "$path" 2>/dev/null || true)"
    if [[ -n "$rendered" ]]; then
      mode="python"
    fi
  fi
  if [[ -z "$rendered" ]]; then
    rendered="$(_parse_yaml_native "$path")"
  fi

  log_info "Parsed config using $mode parser"

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    eval "export $line"
  done <<< "$rendered"

  export DEPLOY_CFG_ENVIRONMENT="$env_name"
  export DEPLOY_CFG_SOURCE_FILE="$path"
}

# Convenience getter that errors out when a required field is missing.
require_cfg() {
  local name="$1"
  local var="DEPLOY_CFG_${name}"
  if [[ -z "${!var:-}" ]]; then
    log_error "Required config key missing: $name (env $DEPLOY_CFG_ENVIRONMENT)"
    return 1
  fi
  printf '%s' "${!var}"
}
