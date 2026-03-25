#!/usr/bin/env bash
set -euo pipefail

# Security report generator for WordPress projects.
# Reads JSON scan output from stdin (piped from scan-dependencies.sh)
# and generates a Markdown security report.
#
# Usage: scan-dependencies.sh | generate-report.sh
#
# Exit codes:
#   0 — clean or low severity only
#   1 — high severity vulnerabilities found
#   2 — critical severity vulnerabilities found

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORT_DIR="$PROJECT_ROOT/.claude/security-reports"

mkdir -p "$REPORT_DIR"

# Detect Python 3 command (python3 or python)
PYTHON=""
if python3 --version >/dev/null 2>&1; then
  PYTHON="python3"
elif python --version >/dev/null 2>&1; then
  PYTHON="python"
fi

if [[ -z "$PYTHON" ]]; then
  echo "[ERROR] Python 3 is required but not found" >&2
  exit 2
fi

# All informational output goes to stderr
log()  { echo "[INFO]  $*" >&2; }
warn() { echo "[WARN]  $*" >&2; }
err()  { echo "[ERROR] $*" >&2; }

log "Reading scan data from stdin …"

# Read all stdin into a variable
SCAN_JSON="$(cat)"

if [[ -z "$SCAN_JSON" ]]; then
  err "No input received on stdin"
  exit 2
fi

log "Generating security report …"

# Temp files for inter-process communication
EXIT_CODE_FILE="$REPORT_DIR/.exit_code_$$"
PYSCRIPT="$(mktemp)"
JSON_INPUT="$(mktemp)"
trap 'rm -f "$EXIT_CODE_FILE" "$PYSCRIPT" "$JSON_INPUT"' EXIT

# Write JSON to temp file (avoids command-line argument length limits)
echo "$SCAN_JSON" > "$JSON_INPUT"

cat > "$PYSCRIPT" << 'PYTHON_EOF'
import json
import sys
import os
from datetime import datetime

with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)
report_dir = sys.argv[2]
exit_code_file = sys.argv[3]

scan_date = data.get("scan_date", "unknown")
scan_path = data.get("scan_path", "unknown")
results = data.get("results", [])

# Collect all vulnerabilities
all_vulns = []
for r in results:
    for v in r.get("vulnerabilities", []):
        v["_scanner"] = r.get("scanner", "unknown")
        all_vulns.append(v)

# Count by severity
counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "other": 0}
for v in all_vulns:
    sev = v.get("severity", "unknown").lower()
    if sev in counts:
        counts[sev] += 1
    else:
        counts["other"] += 1

total = sum(counts.values())

# Determine overall status
if counts["critical"] > 0:
    status_icon = "\U0001f534"   # red circle
    status_label = "CRITICAL"
    exit_code = 2
elif counts["high"] > 0:
    status_icon = "\U0001f7e0"   # orange circle
    status_label = "HIGH RISK"
    exit_code = 1
elif counts["medium"] > 0:
    status_icon = "\U0001f7e1"   # yellow circle
    status_label = "MODERATE"
    exit_code = 0
elif counts["low"] > 0:
    status_icon = "\U0001f7e2"   # green circle
    status_label = "LOW RISK"
    exit_code = 0
else:
    status_icon = "\u2705"       # checkmark
    status_label = "CLEAN"
    exit_code = 0

# Format scan date for display
try:
    dt = datetime.fromisoformat(scan_date.replace("Z", "+00:00"))
    display_date = dt.strftime("%Y-%m-%d %H:%M:%S UTC")
    file_date = dt.strftime("%Y-%m-%d")
except Exception:
    display_date = scan_date
    file_date = datetime.now().strftime("%Y-%m-%d")

# Shorthand variables for counts
c_crit = counts["critical"]
c_high = counts["high"]
c_med = counts["medium"]
c_low = counts["low"]
c_other = counts["other"]

# Build report
lines = []
lines.append("# Security Audit Report")
lines.append("")
lines.append(f"**Scan Date:** {display_date}")
lines.append(f"**Scan Path:** `{scan_path}`")
lines.append(f"**Total Vulnerabilities:** {total}")
lines.append("")

# Overall status
lines.append("## Overall Status")
lines.append("")
lines.append(f"{status_icon} **{status_label}**")
lines.append("")

# Summary table
lines.append("## Vulnerability Summary")
lines.append("")
lines.append("| Severity | Count |")
lines.append("|----------|-------|")
lines.append(f"| Critical | {c_crit} |")
lines.append(f"| High     | {c_high} |")
lines.append(f"| Medium   | {c_med} |")
lines.append(f"| Low      | {c_low} |")
lines.append(f"| Other    | {c_other} |")
lines.append(f"| **Total** | **{total}** |")
lines.append("")

# Scanner results summary
lines.append("## Scanner Results")
lines.append("")
lines.append("| Scanner | Status |")
lines.append("|---------|--------|")
for r in results:
    scanner = r.get("scanner", "unknown")
    status = r.get("status", "unknown")
    vuln_count = len(r.get("vulnerabilities", []))
    if status == "clean":
        status_display = "Clean \u2014 no vulnerabilities"
    elif status == "vulnerable":
        status_display = f"Vulnerable \u2014 {vuln_count} issue(s) found"
    elif status == "skipped":
        status_display = "Skipped \u2014 scanner not available or no lock file"
    elif status == "error":
        status_display = "Error \u2014 scanner failed"
    else:
        status_display = status
    lines.append(f"| {scanner} | {status_display} |")
lines.append("")

# Helper for detailed vulnerability section
def vuln_detail(v):
    detail = []
    pkg = v.get("package", "unknown")
    cve = v.get("cve", "")
    desc = v.get("description", "")
    affected = v.get("affected_versions", "")
    title = v.get("title", "")
    source = v.get("source", "")
    scanner = v.get("_scanner", "")

    heading = pkg
    if cve:
        heading += f" ({cve})"
    detail.append(f"### {heading}")
    detail.append("")
    if desc:
        detail.append(f"**Description:** {desc}")
    if title and title != desc:
        detail.append(f"**Advisory:** {title}")
    if affected:
        detail.append(f"**Affected Versions:** `{affected}`")
    if source:
        detail.append(f"**Source:** {source}")
    if scanner:
        detail.append(f"**Scanner:** {scanner}")
    detail.append("")
    detail.append("**Remediation:**")
    detail.append(f"- Update `{pkg}` to a patched version")
    if cve:
        detail.append(f"- Review {cve} for specific guidance")
    detail.append("- Check for alternative packages if no patch is available")
    detail.append("")
    return detail

# Critical vulnerabilities section
critical_vulns = [v for v in all_vulns if v.get("severity", "").lower() == "critical"]
if critical_vulns:
    lines.append("## Critical Vulnerabilities")
    lines.append("")
    for v in critical_vulns:
        lines.extend(vuln_detail(v))

# High severity section
high_vulns = [v for v in all_vulns if v.get("severity", "").lower() == "high"]
if high_vulns:
    lines.append("## High Severity Vulnerabilities")
    lines.append("")
    for v in high_vulns:
        lines.extend(vuln_detail(v))

# Medium/Low section — compact table
medium_low = [v for v in all_vulns if v.get("severity", "").lower() in ("medium", "low")]
if medium_low:
    lines.append("## Medium and Low Severity Vulnerabilities")
    lines.append("")
    lines.append("| Package | Severity | CVE | Description | Affected Versions |")
    lines.append("|---------|----------|-----|-------------|-------------------|")
    for v in medium_low:
        pkg = v.get("package", "unknown")
        sev = v.get("severity", "unknown").capitalize()
        cve = v.get("cve", "") or "\u2014"
        desc = v.get("description", "") or "\u2014"
        affected = v.get("affected_versions", "") or "\u2014"
        desc = desc.replace("|", "\\|")
        lines.append(f"| {pkg} | {sev} | {cve} | {desc} | `{affected}` |")
    lines.append("")

# Other severity
other_vulns = [v for v in all_vulns if v.get("severity", "").lower() not in ("critical", "high", "medium", "low")]
if other_vulns:
    lines.append("## Other Vulnerabilities")
    lines.append("")
    lines.append("| Package | Severity | CVE | Description | Affected Versions |")
    lines.append("|---------|----------|-----|-------------|-------------------|")
    for v in other_vulns:
        pkg = v.get("package", "unknown")
        sev = v.get("severity", "unknown").capitalize()
        cve = v.get("cve", "") or "\u2014"
        desc = v.get("description", "") or "\u2014"
        affected = v.get("affected_versions", "") or "\u2014"
        desc = desc.replace("|", "\\|")
        lines.append(f"| {pkg} | {sev} | {cve} | {desc} | `{affected}` |")
    lines.append("")

# Recommendations
lines.append("## Recommendations")
lines.append("")
if c_crit > 0:
    lines.append(f"1. **IMMEDIATE ACTION REQUIRED:** {c_crit} critical vulnerability(ies) detected. Update affected packages immediately.")
    lines.append("2. Review each critical CVE and apply patches or upgrade to fixed versions.")
    lines.append("3. Consider temporarily disabling affected functionality until patches are applied.")
if c_high > 0:
    n = 4 if c_crit > 0 else 1
    lines.append(f"{n}. **High Priority:** {c_high} high severity vulnerability(ies) should be addressed within 48 hours.")
    lines.append(f"{n+1}. Review high severity CVEs and plan upgrades.")
if c_med > 0:
    n = 1
    if c_crit > 0:
        n = 6
    elif c_high > 0:
        n = 3
    lines.append(f"{n}. **Medium Priority:** {c_med} medium severity issue(s) should be addressed in the next release cycle.")
if c_low > 0:
    lines.append(f"- **Low Priority:** {c_low} low severity issue(s) \u2014 address when convenient.")
if total == 0:
    lines.append("- No vulnerabilities found. Continue regular dependency updates to maintain security.")
    lines.append("- Schedule periodic scans to detect newly disclosed vulnerabilities.")

lines.append("")
lines.append("---")
lines.append(f"*Report generated on {display_date}*")
lines.append("")

report = "\n".join(lines)

# Write report to file
report_file = os.path.join(report_dir, f"security-report-{file_date}.md")
with open(report_file, "w", encoding="utf-8") as f:
    f.write(report)

# Log to stderr
print(f"[INFO]  Report saved to {report_file}", file=sys.stderr)

# Output report to stdout
sys.stdout.buffer.write(report.encode("utf-8"))
sys.stdout.buffer.write(b"\n")

# Write exit code to temp file
with open(exit_code_file, "w") as f:
    f.write(str(exit_code))
PYTHON_EOF

export PYTHONUTF8=1
$PYTHON "$PYSCRIPT" "$JSON_INPUT" "$REPORT_DIR" "$EXIT_CODE_FILE"

# Read exit code from temp file
EXIT_CODE=0
if [[ -f "$EXIT_CODE_FILE" ]]; then
  EXIT_CODE="$(tr -d '[:space:]' < "$EXIT_CODE_FILE")"
fi

exit "${EXIT_CODE:-0}"
