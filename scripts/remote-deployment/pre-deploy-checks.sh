#!/usr/bin/env bash
# Pre-deployment validation gate.
#
# Usage:
#   pre-deploy-checks.sh [--target theme:<name>|plugin:<name>|all] [--strict]
#
# Runs:
#   1. Theme structure validation (style.css, theme.json, required templates)
#   2. WordPress security scan (PHP code)
#   3. WordPress coding standards (PHPCS)
#   4. Dependency vulnerability scan
#   5. Build artifact validation (no node_modules, no .env, bundle size)
#
# Exit codes:
#   0 — all checks passed
#   1 — at least one blocking failure
#   2 — script invocation error

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

TARGET="all"
STRICT=false
FAILURES=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [--target SPEC] [--strict]

  --target SPEC   theme:<name>, plugin:<name>, or 'all' (default)
  --strict        treat warnings as failures
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --strict) STRICT=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) log_error "Unknown argument: $1"; usage; exit 2 ;;
  esac
done

banner "Pre-deployment checks (target=$TARGET strict=$STRICT)"

run_check() {
  local name="$1"; shift
  log_step "$name"
  if "$@"; then
    log_ok "$name passed"
  else
    log_error "$name FAILED"
    FAILURES=$((FAILURES + 1))
  fi
}

run_warn_check() {
  local name="$1"; shift
  log_step "$name"
  if "$@"; then
    log_ok "$name passed"
  else
    log_warn "$name produced warnings"
    if $STRICT; then FAILURES=$((FAILURES + 1)); fi
  fi
}

# Resolve the list of theme/plugin source paths to validate.
resolve_targets() {
  local kind="${TARGET%%:*}"
  local name="${TARGET#*:}"
  case "$kind" in
    theme)   printf '%s\n' "$PROJECT_ROOT/themes/$name" ;;
    plugin)  printf '%s\n' "$PROJECT_ROOT/plugins/$name" ;;
    all|"")
      [[ -d "$PROJECT_ROOT/themes" ]]  && find "$PROJECT_ROOT/themes"  -mindepth 1 -maxdepth 1 -type d
      [[ -d "$PROJECT_ROOT/plugins" ]] && find "$PROJECT_ROOT/plugins" -mindepth 1 -maxdepth 1 -type d
      ;;
    *) log_error "Unknown target kind: $kind"; return 2 ;;
  esac
}

mapfile -t SOURCE_PATHS < <(resolve_targets)

if [[ ${#SOURCE_PATHS[@]} -eq 0 ]]; then
  log_warn "No deployable sources found for target '$TARGET'"
  exit 0
fi

# 1. Theme/plugin structure validation -----------------------------------------
check_structure() {
  local failed=0
  for src in "${SOURCE_PATHS[@]}"; do
    [[ -d "$src" ]] || continue
    local name
    name="$(basename "$src")"
    if [[ "$src" == */themes/* ]]; then
      [[ -f "$src/style.css"  ]] || { log_error "$name: missing style.css"; failed=1; }
      [[ -f "$src/theme.json" ]] || { log_warn  "$name: missing theme.json (FSE themes require this)"; }
    elif [[ "$src" == */plugins/* ]]; then
      if ! ls "$src"/*.php >/dev/null 2>&1; then
        log_error "$name: no PHP entry file"; failed=1
      fi
    fi
  done
  return $failed
}

# 2. PHP security scan ---------------------------------------------------------
check_security() {
  local script="$PROJECT_ROOT/scripts/wordpress/security-scan.sh"
  [[ -x "$script" ]] || { log_warn "security-scan.sh not found, skipping"; return 0; }
  local failed=0
  for src in "${SOURCE_PATHS[@]}"; do
    [[ -d "$src" ]] || continue
    while IFS= read -r php; do
      local payload
      payload="{\"tool_input\":{\"file_path\":\"$php\"}}"
      if ! echo "$payload" | "$script" >/dev/null 2>&1; then
        local rc=$?
        if [[ $rc -eq 2 ]]; then
          log_error "Security issue: $php"; failed=1
        fi
      fi
    done < <(find "$src" -name '*.php' -type f 2>/dev/null)
  done
  return $failed
}

# 3. WordPress coding standards ------------------------------------------------
check_phpcs() {
  local script="$PROJECT_ROOT/scripts/wordpress/check-coding-standards.sh"
  [[ -x "$script" ]] || { log_warn "check-coding-standards.sh not found, skipping"; return 0; }
  local failed=0
  for src in "${SOURCE_PATHS[@]}"; do
    [[ -d "$src" ]] || continue
    if ! "$script" "$src" >/dev/null 2>&1; then
      log_warn "PHPCS findings in $(basename "$src")"
      failed=1
    fi
  done
  return $failed
}

# 4. Dependency vulnerability scan ---------------------------------------------
check_dependencies() {
  local script="$PROJECT_ROOT/scripts/security-audit/scan-dependencies.sh"
  [[ -x "$script" ]] || { log_warn "scan-dependencies.sh not found, skipping"; return 0; }
  if "$script" "$PROJECT_ROOT" >/dev/null 2>&1; then
    return 0
  fi
  local rc=$?
  case $rc in
    1) log_error "Dependency scanner found vulnerabilities"; return 1 ;;
    *) log_warn  "Dependency scanner exited with code $rc"; return 0 ;;
  esac
}

# 5. Build artifact validation -------------------------------------------------
check_artifacts() {
  local failed=0
  for src in "${SOURCE_PATHS[@]}"; do
    [[ -d "$src" ]] || continue
    local name
    name="$(basename "$src")"
    if find "$src" -name 'node_modules' -type d -print -quit | grep -q .; then
      log_error "$name: node_modules present in source — exclude before deploy"
      failed=1
    fi
    if find "$src" -name '.env' -type f -print -quit | grep -q .; then
      log_error "$name: .env file present — secret leak risk, do not deploy"
      failed=1
    fi
    local size_kb
    size_kb="$(du -sk "$src" 2>/dev/null | awk '{print $1}')"
    if [[ -n "$size_kb" && "$size_kb" -gt 51200 ]]; then
      log_warn "$name: bundle is ${size_kb}KB (>50MB) — review before deploy"
    fi
  done
  return $failed
}

run_check "Structure validation"      check_structure
run_check "Security scan"             check_security
run_warn_check "Coding standards"     check_phpcs
run_check "Dependency scan"           check_dependencies
run_check "Artifact validation"       check_artifacts

if [[ $FAILURES -gt 0 ]]; then
  log_error "$FAILURES pre-deployment check(s) failed"
  log_event "pre_deploy_failed" "failures=$FAILURES target=$TARGET"
  exit 1
fi

log_ok "All pre-deployment checks passed"
log_event "pre_deploy_ok" "target=$TARGET"
