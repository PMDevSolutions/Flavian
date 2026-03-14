# Validation Criteria: MCP Troubleshooting Guide

**Purpose:** Define requirements for the MCP (Model Context Protocol) troubleshooting guide to ensure completeness and actionability.

**Version:** 1.0.0
**Created:** 2026-03-14

---

## MCP Servers Covered

The guide MUST cover all MCP servers configured in `.mcp.json`:

### Required MCP Server Coverage

| Server | Type | URL/Command | Description |
|--------|------|-------------|-------------|
| figma-desktop | HTTP | http://127.0.0.1:3845/mcp | Figma Desktop app MCP server (local) |
| figma | HTTP | https://mcp.figma.com/mcp | Figma remote MCP server (fallback) |
| playwright | Command | npx @playwright/mcp@latest --headless | Playwright browser automation |

### Future MCP Server Placeholders

These servers may be added in the future and should have placeholder sections:

- [ ] Chrome DevTools MCP (not currently configured)
- [ ] Core Memory MCP (not currently configured)

---

## Required Sections

The guide MUST include all of the following sections:

### 1. Understanding MCP in This Project
- [ ] What MCP is and why it's used
- [ ] List of all configured MCP servers
- [ ] What each server provides
- [ ] How Claude Code uses MCP

### 2. Verifying MCP Configuration
- [ ] How to validate .mcp.json syntax
- [ ] How to check each server is accessible
- [ ] Expected behavior when working correctly
- [ ] Common configuration errors

### 3. Figma MCP Issues (Desktop)
- [ ] "Cannot connect to Figma Desktop MCP" (connection refused)
- [ ] "Figma file not found" (invalid file key/URL)
- [ ] "Permission denied" / "Access denied"
- [ ] "Node not found" (invalid node ID)
- [ ] "Design context extraction failed"
- [ ] "Dev Mode not enabled"
- [ ] MCP server not starting

### 4. Figma MCP Issues (Remote)
- [ ] Authentication issues (401/403)
- [ ] Rate limiting
- [ ] Token expiration
- [ ] Network connectivity

### 5. Playwright MCP Issues
- [ ] "Browser not installed"
- [ ] "Page navigation failed"
- [ ] "Screenshot capture failed"
- [ ] "Timeout errors"
- [ ] Server not starting
- [ ] Different browser engines (Chromium, Firefox, WebKit)

### 6. Chrome DevTools MCP Issues (Placeholder)
- [ ] Connection issues
- [ ] Page not responding
- [ ] Lighthouse audit failed
- [ ] Note: Not currently configured

### 7. Core Memory MCP Issues (Placeholder)
- [ ] Connection issues
- [ ] Memory search failures
- [ ] Note: Not currently configured

### 8. General MCP Debugging
- [ ] How to check MCP server logs
- [ ] How to restart MCP servers
- [ ] How to test MCP connectivity
- [ ] Fallback procedures when MCP is unavailable
- [ ] Debugging MCP in Claude Code

### 9. MCP Validation Script
- [ ] Script must exist at scripts/check-mcp.sh
- [ ] Validates .mcp.json syntax
- [ ] Tests connectivity to each server
- [ ] Reports status for each MCP
- [ ] Provides actionable error messages

---

## Issue Format Requirements

Each issue MUST follow this exact structure:

```markdown
### [Issue Title]

**Difficulty:** [Easy/Medium/Hard] | **Time to Fix:** [estimated time]

**Symptom**
[Clear description of visible problem, error message, or unexpected behavior]

**Cause**
[Technical explanation of the root cause]

**Fix**
1. [First step with exact command or action]
2. [Second step]
3. [Additional steps as needed]

**Prevention**
[Proactive measures to prevent recurrence]
```

### Format Validation Rules

1. **Symptom section MUST include:**
   - Actual error message (if applicable)
   - Context where error appears
   - Related error messages

2. **Cause section MUST include:**
   - Technical root cause
   - Why the error occurs
   - Common triggers

3. **Fix section MUST include:**
   - Numbered steps (not bullet points)
   - Exact commands with paths
   - Expected output after key steps
   - Verification step to confirm fix worked

4. **Prevention section MUST include:**
   - At least one proactive measure
   - Reference to best practices

---

## Coverage Requirements

### Error Types

The guide MUST cover these error categories:

| Category | Description | Required Issues |
|----------|-------------|-----------------|
| Connection | Server not reachable | At least 3 |
| Authentication | Permission/access issues | At least 2 |
| Configuration | .mcp.json errors | At least 2 |
| Runtime | Errors during operation | At least 3 |
| Environment | Missing dependencies | At least 2 |

### Tool Coverage

Issues MUST reference these tools where applicable:

- [ ] curl (for HTTP testing)
- [ ] node/npm/npx (for Playwright)
- [ ] Figma Desktop application
- [ ] Claude Code terminal
- [ ] Browser (for Figma authentication)
- [ ] JSON validators

### Platform Coverage

Commands MUST work on:

- [ ] Windows (Git Bash / PowerShell)
- [ ] macOS
- [ ] Linux

---

## Quality Criteria

### Actionability Score

Each issue must score at least 4/5 on actionability:

| Score | Criteria |
|-------|----------|
| 5 | User can fix issue without any external help |
| 4 | User can fix with minimal additional research |
| 3 | User needs to reference other documentation |
| 2 | User needs significant troubleshooting |
| 1 | Issue description only, no clear path to fix |

### Command Completeness

All commands MUST:
- [ ] Use platform-appropriate syntax
- [ ] Include expected output descriptions
- [ ] Work in Claude Code environment
- [ ] Be copy-pasteable

### Cross-Reference Requirements

The guide MUST link to:
- [ ] docs/TROUBLESHOOTING.md (existing MCP sections)
- [ ] docs/COMMON-FAILURES-FIXES.md (Section 1.2)
- [ ] .mcp.json (for reference)
- [ ] scripts/check-mcp.sh (validation script)
- [ ] scripts/setup-playwright.sh (Playwright setup)

---

## Script Requirements: check-mcp.sh

The validation script MUST:

### Functionality
- [ ] Check if .mcp.json exists and is valid JSON
- [ ] Test Figma Desktop MCP connectivity (http://127.0.0.1:3845/mcp)
- [ ] Test Figma Remote MCP connectivity (https://mcp.figma.com/mcp)
- [ ] Check if Playwright is installed (npx @playwright/mcp@latest --help)
- [ ] Report status for each server (PASS/FAIL/WARN)

### Output Format
- [ ] Color-coded output (green=pass, red=fail, yellow=warn)
- [ ] Summary section with overall status
- [ ] Actionable error messages with fix suggestions
- [ ] Exit code: 0 if all pass, 1 if any critical fail

### Cross-Platform Support
- [ ] Works on Windows (Git Bash)
- [ ] Works on macOS
- [ ] Works on Linux
- [ ] Handles missing dependencies gracefully

---

## Validation Checklist

Before the guide is considered complete, verify:

### Section Completeness
- [ ] All 9 required sections present
- [ ] Each MCP server has dedicated section
- [ ] All specific issues listed above are covered

### Format Compliance
- [ ] Every issue has all 4 components (Symptom, Cause, Fix, Prevention)
- [ ] Difficulty and time estimates included
- [ ] Fix sections use numbered steps
- [ ] Commands are complete and executable

### Script Requirements
- [ ] scripts/check-mcp.sh exists
- [ ] Script is executable (chmod +x)
- [ ] Script tests all configured MCP servers
- [ ] Script provides actionable output

### Coverage
- [ ] All error types covered
- [ ] All tools covered
- [ ] All platforms covered

### Quality
- [ ] Each issue scores 4+ on actionability
- [ ] Cross-references present and working
- [ ] Commands are platform-appropriate

### Usability
- [ ] Table of contents present
- [ ] Quick reference section
- [ ] Estimated time to fix included
- [ ] Difficulty level indicated

---

## Expected Issues Count

| Section | Minimum Issues |
|---------|----------------|
| Figma Desktop MCP | 7 |
| Figma Remote MCP | 4 |
| Playwright MCP | 5 |
| Chrome DevTools (Placeholder) | 3 |
| Core Memory (Placeholder) | 2 |
| General Debugging | 4 |
| **Total** | **25** |

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-14 | Claude Code | Initial validation criteria |

---

## Validation Status

**Status:** PASSED

**Guide Location:** `docs/MCP-TROUBLESHOOTING.md`

**Script Location:** `scripts/check-mcp.sh`

| Requirement | Status |
|-------------|--------|
| Guide created | PASS |
| All sections present | PASS |
| All issues documented | PASS (25+ issues) |
| Script created | PASS |
| Cross-references updated | PASS |

### Validation Summary

**Total Issues Documented:** 25+ issues covering:
- Figma Desktop MCP: 7 issues (3.1-3.7)
- Figma Remote MCP: 4 issues (4.1-4.4)
- Playwright MCP: 6 issues (5.1-5.6)
- Chrome DevTools MCP: 3 placeholder issues (6.1-6.3)
- Core Memory MCP: 2 placeholder issues (7.1-7.2)
- General Debugging: 5 issues (8.1-8.5)

**Cross-References Added:**
- COMMON-FAILURES-FIXES.md Section 1.2 now links to MCP-TROUBLESHOOTING.md
- COMMON-FAILURES-FIXES.md Related Documentation section updated
- TROUBLESHOOTING.md Figma MCP section links to MCP-TROUBLESHOOTING.md
- TROUBLESHOOTING.md Playwright MCP section links to MCP-TROUBLESHOOTING.md

**Script Features:**
- Validates .mcp.json syntax
- Tests Figma Desktop MCP connectivity
- Tests Figma Remote MCP connectivity
- Checks Node.js version
- Checks Playwright installation
- Checks browser installations
- Color-coded output
- Summary with pass/fail/warn counts
- Actionable error messages

**All validation criteria met. Documentation is ready for use.**
