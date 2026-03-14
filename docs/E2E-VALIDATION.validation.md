# E2E Validation Guide - Validation Checklist

This document defines acceptance criteria for `E2E-VALIDATION.md`. Use this checklist to validate the guide is complete and provides actionable validation procedures for WordPress FSE themes.

---

## Phase Requirements

### 1. Pre-Installation Validation
- [ ] Contains theme structure checklist
- [ ] Lists all required files (style.css, theme.json, templates/index.html)
- [ ] Includes theme.json validation steps
- [ ] References existing `scripts/validate-theme.sh` script
- [ ] Provides manual verification commands
- [ ] Lists expected output for each check

### 2. WordPress Installation Testing
- [ ] Step-by-step Docker setup instructions
- [ ] Commands to copy/mount theme
- [ ] Theme activation procedure
- [ ] PHP error checking in debug.log
- [ ] WP_DEBUG configuration instructions
- [ ] Expected output for successful activation

### 3. Visual Validation
- [ ] Homepage comparison to Figma design
- [ ] Template page rendering verification
- [ ] Image loading verification
- [ ] Design token (color) validation
- [ ] Typography rendering checks
- [ ] Responsive breakpoint testing (mobile, tablet, desktop, extra-large)
- [ ] Screenshot capture commands (using cross-browser-test.sh)

### 4. Functional Validation
- [ ] Navigation functionality tests
- [ ] Link verification procedures
- [ ] Form functionality (if applicable)
- [ ] Search functionality
- [ ] 404 page display
- [ ] Template hierarchy verification

### 5. Cross-Browser Testing
- [ ] Chrome/Chromium testing
- [ ] Firefox testing
- [ ] Safari/WebKit testing
- [ ] Mobile browser considerations
- [ ] Playwright integration (scripts/cross-browser-test.sh)

### 6. Performance Validation
- [ ] Lighthouse audit instructions (with target scores)
- [ ] Core Web Vitals checklist
- [ ] Image optimization verification
- [ ] Bundle size considerations
- [ ] Load time benchmarks

### 7. Accessibility Validation
- [ ] WCAG 2.1 AA checklist items
- [ ] Keyboard navigation testing
- [ ] Screen reader compatibility notes
- [ ] Color contrast verification
- [ ] Focus state verification

### 8. Validation Checklist Template
- [ ] Copy-paste ready checklist format
- [ ] All phases included
- [ ] Pass/Fail columns
- [ ] Notes column for issues
- [ ] Sign-off section

---

## Content Quality Criteria

### Completeness
- [ ] All 8 validation phases documented
- [ ] Each phase has specific, runnable commands
- [ ] Expected outputs documented for each command
- [ ] Failure scenarios and remediation steps included
- [ ] Links to relevant scripts in project

### Clarity
- [ ] Commands are complete and copy-pasteable
- [ ] No ambiguous instructions
- [ ] Each step clearly numbered
- [ ] Prerequisites stated before each section
- [ ] Uses existing project scripts where available

### Actionability
- [ ] Every validation step has a clear pass/fail criteria
- [ ] Target scores/metrics specified where applicable
- [ ] Remediation steps for failures
- [ ] Links to TROUBLESHOOTING.md for common issues

### Integration
- [ ] References scripts/validate-theme.sh
- [ ] References scripts/cross-browser-test.sh
- [ ] References scripts/wordpress/check-performance.sh
- [ ] References scripts/wordpress/security-scan.sh
- [ ] References wordpress-local.sh commands
- [ ] Consistent with LOCAL-DEVELOPMENT.md instructions

---

## Tools Referenced

### Must Reference
- [ ] Docker / docker-compose
- [ ] wordpress-local.sh helper script
- [ ] scripts/validate-theme.sh (existing orchestrator)
- [ ] scripts/cross-browser-test.sh (Playwright)
- [ ] Lighthouse CLI or DevTools

### Should Reference
- [ ] scripts/wordpress/check-performance.sh
- [ ] scripts/wordpress/security-scan.sh
- [ ] scripts/theme-token-auditor/audit-tokens.sh
- [ ] scripts/block-markup-validator/validate-block-markup.sh

### May Reference
- [ ] axe DevTools (accessibility)
- [ ] Wave (accessibility)
- [ ] WebPageTest
- [ ] GTmetrix

---

## Target Metrics

### Lighthouse Scores
- [ ] Performance: 90+ documented as target
- [ ] Accessibility: 90+ documented as target
- [ ] Best Practices: 90+ documented as target
- [ ] SEO: 90+ documented as target

### Core Web Vitals
- [ ] LCP (Largest Contentful Paint): < 2.5s
- [ ] FID (First Input Delay): < 100ms
- [ ] CLS (Cumulative Layout Shift): < 0.1

### Breakpoints
- [ ] Mobile: 375px documented
- [ ] Tablet: 768px documented
- [ ] Desktop: 1440px documented
- [ ] Extra-large: 1920px documented

---

## Script Requirements (validate-theme-e2e.sh)

### Input Validation
- [ ] Accepts theme name as argument
- [ ] Validates theme exists in themes/ directory
- [ ] Shows usage if no argument provided
- [ ] Lists available themes on error

### Checks Implemented
- [ ] Pre-installation checks (file structure)
- [ ] theme.json validity
- [ ] Required files exist
- [ ] WordPress activation test (if Docker running)
- [ ] Lighthouse audit (if URL accessible)
- [ ] Accessibility check (axe-core or similar)

### Output
- [ ] Clear PASS/WARN/FAIL indicators
- [ ] Summary at end
- [ ] Optional report file (--report flag)
- [ ] Exit codes (0=pass, 1=warn, 2=fail)

### Integration
- [ ] Calls existing scripts where appropriate
- [ ] Works standalone without Docker (pre-install only)
- [ ] Works with Docker for full validation
- [ ] Consistent output format with validate-theme.sh

---

## Validation Process

1. Read E2E-VALIDATION.md top to bottom
2. Check off each item above as verified
3. Test commands in clean environment
4. Run validate-theme-e2e.sh on sample theme
5. Document any failures with line references

**Validation Status:** [ ] PASS / [ ] FAIL

**Validator:** _________________

**Date:** _________________

**Notes:**
```
[Space for validation notes]
```

---

## Success Criteria

The E2E-VALIDATION.md document passes validation if:

1. All "Must Reference" tools are documented
2. All 8 validation phases have complete instructions
3. Every validation step has clear pass/fail criteria
4. The validation checklist template is copy-paste ready
5. The validate-theme-e2e.sh script runs without errors
6. Commands are tested and produce documented outputs
