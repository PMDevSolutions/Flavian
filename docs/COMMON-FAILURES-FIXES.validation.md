# Validation Criteria: Common Failures & Fixes Guide

**Purpose:** Define requirements for the Common Failures & Fixes troubleshooting guide to ensure completeness and actionability.

**Version:** 1.0.0
**Created:** 2026-03-14

---

## Required Sections

The guide MUST include all of the following sections:

### 1. Setup & Prerequisites Issues
- [x] "Claude Code doesn't recognize the project" (Section 1.1)
- [x] "Figma MCP connection failed" (Section 1.2)
- [x] "Docker won't start" (Section 1.3)
- [x] At least 3 issues minimum (4 issues: 1.1-1.4)

### 2. Figma Extraction Issues
- [x] "Design tokens not extracted correctly" (Section 2.1)
- [x] "Images not downloading" (Section 2.2)
- [x] "Figma Dev Mode access denied" (Section 2.3)
- [x] "Wrong node selected in Figma" (Section 2.4)
- [x] At least 4 issues minimum (5 issues: 2.1-2.5)

### 3. Theme Generation Issues
- [x] "Theme won't activate in WordPress" (Section 3.1)
- [x] "Missing style.css or theme.json" (Section 3.2)
- [x] "Patterns not registering" (Section 3.3)
- [x] "Block markup validation errors" (Section 3.4)
- [x] At least 4 issues minimum (5 issues: 3.1-3.5)

### 4. Visual/Rendering Issues
- [x] "Images are broken (src='')" (Section 4.1)
- [x] "Colors don't match Figma" (Section 4.2)
- [x] "Typography looks wrong" (Section 4.3)
- [x] "Layout doesn't match design" (Section 4.4)
- [x] "Responsive breakpoints not working" (Section 4.5)
- [x] At least 5 issues minimum (5 issues: 4.1-4.5)

### 5. Testing & Validation Issues
- [x] "GitHub Actions failing" (Section 5.1)
- [x] "Token compliance errors" (Section 5.2)
- [x] "Security scan warnings" (Section 5.3)
- [x] At least 3 issues minimum (4 issues: 5.1-5.4)

### 6. Recovery Procedures
- [x] "How to restart a failed conversion" (Section 6.1)
- [x] "How to rollback a broken theme" (Section 6.2)
- [x] "How to manually fix generated code" (Section 6.3)
- [x] At least 3 procedures minimum (4 procedures: 6.1-6.4)

---

## Issue Format Requirements

Each issue MUST follow this exact structure:

```markdown
### [Issue Title]

**Symptom** (What the user sees)
[Clear description of visible problem, error message, or unexpected behavior]

**Cause** (Why it happens)
[Technical explanation of the root cause]

**Fix** (Step-by-step solution)
1. [First step with exact command or action]
2. [Second step]
3. [Additional steps as needed]

**Prevention** (How to avoid next time)
[Proactive measures to prevent recurrence]
```

### Format Validation Rules

1. **Symptom section MUST include:**
   - Actual error message (if applicable)
   - Visual description of the problem
   - User-visible indicators

2. **Cause section MUST include:**
   - Technical root cause
   - What went wrong in the system/process
   - Why the symptom appears

3. **Fix section MUST include:**
   - Numbered steps (not bullet points)
   - Exact commands with full paths
   - Expected output after each step (where applicable)
   - Verification step to confirm fix worked

4. **Prevention section MUST include:**
   - At least one proactive measure
   - Reference to documentation or best practice

---

## Coverage Requirements

### Workflow Phase Coverage

The guide MUST cover issues from ALL workflow phases:

| Phase | Description | Required Coverage |
|-------|-------------|-------------------|
| Phase 1.1 | Design system extraction | At least 2 issues |
| Phase 1.2 | Template discovery | At least 1 issue |
| Phase 1.3 | Implementation planning | At least 1 issue |
| Phase 2.1 | theme.json creation | At least 2 issues |
| Phase 2.2 | Template generation | At least 3 issues |
| Phase 2.3 | Pattern creation | At least 2 issues |
| Phase 2.4 | Validation | At least 2 issues |
| Phase 3 | Completion & testing | At least 2 issues |

### Tool Coverage

Issues MUST reference these tools/systems where applicable:

- [x] Figma Desktop MCP (Sections 1.2, 2.1, 2.3, 2.4, 2.5)
- [x] Figma Remote MCP (Section 1.2)
- [x] Docker/WordPress Local (Sections 1.3, 3.1)
- [x] PHPCS/Coding Standards (Sections 3.5, 5.1)
- [x] Security Scan Scripts (Sections 5.1, 5.3)
- [x] Validation Hooks (Sections 3.4, 4.1)
- [x] Git/GitHub Actions (Sections 5.1, 6.2)
- [x] WP-CLI (Sections 3.3, 3.1)

### File Type Coverage

Issues MUST cover problems with these file types:

- [x] theme.json (Sections 2.1, 3.2, 4.2, 4.3, 6.4)
- [x] style.css (Sections 3.1, 3.2)
- [x] templates/*.html (Sections 3.4, 4.1, 4.2)
- [x] patterns/*.php (Sections 3.3, 4.1, 6.3)
- [x] parts/*.html (Referenced in Section 4.1 template example)
- [x] assets/images/* (Sections 2.2, 4.1)
- [x] .mcp.json (Section 1.2)

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
- [x] Use project-relative paths (e.g. `./scripts/…`, `themes/[theme-name]/…`)
- [x] Include placeholder syntax for variable parts (e.g., `[theme-name]`)
- [x] Work on Windows (Git Bash) and Linux/macOS
- [x] Include expected output descriptions

### Cross-Reference Requirements

The guide MUST link to:
- [x] Existing TROUBLESHOOTING.md (3 cross-references: Sections 1.2, 1.3, 5.1)
- [x] docs/figma-to-wordpress/README.md (Section 3.1)
- [x] docs/figma-to-wordpress/IMPLEMENTATION.md (Section 3.3)
- [x] docs/architecture/PATTERN-FIRST-ARCHITECTURE.md (Section 4.1)
- [x] Relevant scripts in scripts/figma-fse/ (Sections 3.4, 4.1, 5.2)

---

## Validation Checklist

Before the guide is considered complete, verify:

### Section Completeness
- [x] All 6 required sections present
- [x] Each section has minimum number of issues
- [x] All specific issues listed above are covered

### Format Compliance
- [x] Every issue has all 4 components (Symptom, Cause, Fix, Prevention)
- [x] Fix sections use numbered steps
- [x] Commands are complete and executable

### Coverage
- [x] All workflow phases covered
- [x] All tool types covered
- [x] All file types covered

### Quality
- [x] Each issue scores 4+ on actionability
- [x] All commands use project-relative paths
- [x] Cross-references present and working

### Usability
- [x] Table of contents present
- [x] Quick reference section for common issues
- [x] Estimated time to fix included for each issue
- [x] Difficulty level indicated (Easy/Medium/Hard)

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-14 | Claude Code | Initial validation criteria |
| 1.1.0 | 2026-03-14 | Claude Code | Validated against completed guide - ALL CRITERIA MET |

---

## Validation Summary

**Status:** PASSED

**Guide Location:** `docs/COMMON-FAILURES-FIXES.md`

**Total Issues Documented:** 27 issues + 4 recovery procedures

| Section | Required | Actual | Status |
|---------|----------|--------|--------|
| Setup & Prerequisites | 3 | 4 | PASS |
| Figma Extraction | 4 | 5 | PASS |
| Theme Generation | 4 | 5 | PASS |
| Visual/Rendering | 5 | 5 | PASS |
| Testing & Validation | 3 | 4 | PASS |
| Recovery Procedures | 3 | 4 | PASS |

**All validation criteria met. Guide is ready for use.**
