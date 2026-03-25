#!/usr/bin/env bash
set -euo pipefail

# Creates GitHub issues for critical and high severity vulnerabilities.
# Reads JSON scan output from stdin (piped from scan-dependencies.sh).
# Deduplicates against existing open security issues.
#
# Usage: scan-dependencies.sh | create-issues.sh
#
# Exit codes:
#   0 — success (issues created or nothing to do)
#   2 — missing dependency (gh CLI or Python)

# ─── Logging ──────────────────────────────────────────────────────────────────

log()  { echo "[INFO]  $*" >&2; }
warn() { echo "[WARN]  $*" >&2; }
err()  { echo "[ERROR] $*" >&2; }

# ─── Detect Python 3 ─────────────────────────────────────────────────────────

PYTHON=""
if python3 --version >/dev/null 2>&1; then
  PYTHON="python3"
elif python --version >/dev/null 2>&1; then
  PYTHON="python"
fi

if [[ -z "$PYTHON" ]]; then
  err "Python 3 is required but not found"
  exit 2
fi

# ─── Check gh CLI ─────────────────────────────────────────────────────────────

if ! command -v gh >/dev/null 2>&1; then
  err "gh CLI is not installed — cannot create issues"
  err "Install from https://cli.github.com/"
  exit 2
fi

if ! gh auth status >/dev/null 2>&1; then
  err "gh CLI is not authenticated — run 'gh auth login' first"
  exit 2
fi

log "gh CLI authenticated"

# ─── Read scan JSON from stdin ────────────────────────────────────────────────

SCAN_JSON="$(cat)"

if [[ -z "$SCAN_JSON" ]]; then
  err "No input received on stdin"
  exit 2
fi

# ─── Extract critical/high vulnerabilities ────────────────────────────────────

VULNS="$($PYTHON -c "
import json, sys

data = json.loads(sys.argv[1])
vulns = []

for result in data.get('results', []):
    for vuln in result.get('vulnerabilities', []):
        sev = vuln.get('severity', '').lower()
        if sev in ('critical', 'high'):
            vulns.append({
                'package': vuln.get('package', 'unknown'),
                'severity': sev,
                'title': vuln.get('title', ''),
                'description': vuln.get('description', ''),
                'cve': vuln.get('cve', ''),
                'affected_versions': vuln.get('affected_versions', ''),
                'source': vuln.get('source', ''),
                'scan_date': data.get('scan_date', ''),
            })

print(json.dumps(vulns))
" "$SCAN_JSON")"

VULN_COUNT="$($PYTHON -c "import json,sys; print(len(json.loads(sys.argv[1])))" "$VULNS")"

if [[ "$VULN_COUNT" -eq 0 ]]; then
  log "No critical or high severity vulnerabilities found — nothing to do"
  exit 0
fi

log "Found $VULN_COUNT critical/high vulnerabilities"

# ─── Fetch existing open security issues ──────────────────────────────────────

log "Fetching existing open security issues …"
EXISTING_ISSUES="$(gh issue list --label "security" --state open --limit 200 --json title 2>/dev/null || echo "[]")"

# ─── Create issues ────────────────────────────────────────────────────────────

CREATED=0
SKIPPED=0

# Iterate vulnerabilities via Python-generated line-delimited JSON
while IFS= read -r vuln_line; do
  # Parse all fields from the vulnerability in a single Python call
  FIELDS="$($PYTHON -c "
import json, sys
v = json.loads(sys.argv[1])
# Output fields separated by newlines
for k in ['package','severity','cve','description','affected_versions','source','scan_date','title']:
    print(v.get(k, ''))
" "$vuln_line")"

  PACKAGE="$(echo "$FIELDS" | sed -n '1p')"
  SEVERITY="$(echo "$FIELDS" | sed -n '2p')"
  CVE="$(echo "$FIELDS" | sed -n '3p')"
  DESCRIPTION="$(echo "$FIELDS" | sed -n '4p')"
  AFFECTED="$(echo "$FIELDS" | sed -n '5p')"
  SOURCE="$(echo "$FIELDS" | sed -n '6p')"
  SCAN_DATE="$(echo "$FIELDS" | sed -n '7p')"
  TITLE_ID="$(echo "$FIELDS" | sed -n '8p')"

  # Build issue title
  CVE_SUFFIX=""
  if [[ -n "$CVE" ]]; then
    CVE_SUFFIX=" — $CVE"
  fi
  ISSUE_TITLE="[Security] ${SEVERITY^^}: ${PACKAGE}${CVE_SUFFIX}"

  # Check for duplicate: existing issue must contain both the package name and CVE
  IS_DUPLICATE="$($PYTHON -c "
import json, sys

existing = json.loads(sys.argv[1])
package = sys.argv[2]
cve = sys.argv[3]

for issue in existing:
    title = issue.get('title', '')
    if package in title and (not cve or cve in title):
        print('true')
        sys.exit(0)

print('false')
" "$EXISTING_ISSUES" "$PACKAGE" "$CVE")"

  if [[ "$IS_DUPLICATE" == "true" ]]; then
    log "Skipping duplicate: $ISSUE_TITLE"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Build severity label
  SEVERITY_LABEL="severity:${SEVERITY}"

  # Create the issue
  log "Creating issue: $ISSUE_TITLE"

  ISSUE_BODY="$(cat <<EOF
## Security Vulnerability

| Field | Value |
|-------|-------|
| **Severity** | ${SEVERITY^^} |
| **Package** | \`${PACKAGE}\` |
| **CVE** | ${CVE:-N/A} |
| **Advisory** | ${TITLE_ID:-N/A} |
| **Affected Versions** | \`${AFFECTED:-unknown}\` |
| **Scanner** | ${SOURCE:-unknown} |
| **Scan Date** | ${SCAN_DATE:-unknown} |

## Description

${DESCRIPTION:-No description available.}

## Remediation Steps

- [ ] Check if a patched version of \`${PACKAGE}\` is available
- [ ] Update the dependency to the patched version
- [ ] If no patch exists, evaluate alternative packages or apply a workaround
- [ ] Re-run the security scan to verify the fix

## Acceptance Criteria

- [ ] Vulnerability is resolved (patched version installed or package replaced)
- [ ] Security scan passes with no findings for this package/CVE
- [ ] No regressions introduced by the update
- [ ] Changes committed and PR submitted for review
EOF
)"

  gh issue create \
    --title "$ISSUE_TITLE" \
    --body "$ISSUE_BODY" \
    --label "security" \
    --label "$SEVERITY_LABEL" >&2

  CREATED=$((CREATED + 1))

done < <($PYTHON -c "
import json, sys

vulns = json.loads(sys.argv[1])
for v in vulns:
    print(json.dumps(v))
" "$VULNS")

# ─── Summary ──────────────────────────────────────────────────────────────────

log "Done — created: $CREATED, skipped (duplicates): $SKIPPED"
