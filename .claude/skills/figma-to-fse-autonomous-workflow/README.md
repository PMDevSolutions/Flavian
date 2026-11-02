# Figma-to-FSE Autonomous Workflow

**Version:** 1.0.0 (Phase 1 MVP)
**Status:** Ready for testing
**Created:** 2026-01-19

---

## Overview

This skill enables autonomous conversion of Figma designs to WordPress Full Site Editing (FSE) block themes with zero "should I continue?" interruptions.

**Key Innovation:** Hybrid workflow with brief clarification phase (1-2 min) followed by fully autonomous execution converting 1-15 templates without user intervention.

---

## Quick Start

### For Users

```
User: "Convert my Figma designs to WordPress FSE theme"
      [Provide Figma URL]

Claude: [Invokes this skill automatically]
        1. Extracts complete design system
        2. Creates implementation plan
        3. Asks for approval

User: "Yes, proceed"

Claude: [Works autonomously 5-90 minutes]
        - Converts all templates
        - Validates automatically
        - Generates report

Result: Complete FSE theme ready for WordPress
```

### For Developers

See [TESTING-GUIDE.md](./TESTING-GUIDE.md) for detailed testing instructions.

---

## Documentation Files

### Core Documentation

1. **[SKILL.md](./SKILL.md)** (22KB) - Main skill file
   - Complete workflow documentation
   - Phase 1 (Discovery) + Phase 2 (Execution) patterns
   - Figma MCP tool integration
   - Error recovery strategies
   - Component mapping reference
   - No-exceptions list

2. **[IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md)** (40KB) - Implementation details
   - Step-by-step design token extraction
   - Figma variables → theme.json translation
   - Template conversion logic
   - FSE block generation patterns
   - Helper functions and mappings

3. **[TEMPLATE-EXAMPLES.md](./TEMPLATE-EXAMPLES.md)** (20KB) - Reference examples
   - Hero section example (Cover block)
   - Card grid example (Columns block)
   - Content section example (Group + content)
   - Full template with header/footer
   - Quick block reference
   - Common patterns

4. **[AUTONOMOUS-EXECUTION.md](./AUTONOMOUS-EXECUTION.md)** (20KB) - Execution integration
   - Three-phase workflow architecture
   - executing-plans integration pattern
   - Agent behavior during autonomous phase
   - Error recovery patterns
   - Context management (checkpointing)
   - Success metrics

5. **[TESTING-GUIDE.md](./TESTING-GUIDE.md)** (18KB) - Testing instructions
   - Pre-test setup
   - Test scenarios (single template, quality, WordPress, errors)
   - Success criteria
   - Troubleshooting guide
   - Test results template

---

## File Structure

```
.claude/skills/figma-to-fse-autonomous-workflow/
├── README.md                      # This file
├── SKILL.md                       # Main skill definition
├── IMPLEMENTATION-GUIDE.md        # Step-by-step implementation
├── TEMPLATE-EXAMPLES.md           # FSE template examples
├── AUTONOMOUS-EXECUTION.md        # Autonomous workflow integration
└── TESTING-GUIDE.md              # Testing instructions

.claude/agents/
└── figma-fse-converter.md        # Specialized agent (executes Phase 2)

scripts/figma-fse/
├── extract-design-tokens.sh      # Validates theme.json design tokens
├── validate-template.sh          # Validates FSE template syntax
├── log-figma-access.sh          # Logs Figma MCP access
└── generate-comparison-report.sh # Generates completion report

.claude/hooks/
└── figma-fse-post-template.sh   # Runs after each template creation
```

---

## Features

### ✅ Phase 1 MVP (Current)

**Design System Extraction:**
- Wholesale extraction of ALL Figma design tokens
- Colors, typography, spacing, layout settings
- 1:1 mapping to theme.json structure
- Zero placeholder values

**Template Conversion:**
- Figma frame → WordPress FSE template HTML
- Proper block syntax (<!-- wp:block-name -->)
- 100% theme.json token usage (no hardcoded values)
- Responsive layouts (mobile/tablet/desktop)
- Accessibility attributes

**Autonomous Execution:**
- Zero "should I continue?" interruptions
- Error recovery (fallback patterns)
- Automatic validation (security, standards, syntax)
- Progress tracking in `.claude/pipeline/<theme>/state.json` (resumable in a fresh session)
- Completion report generation

**Quality Automation:**
- Post-template hooks validate each template
- Security scanning
- Coding standards checking
- Hardcoded value detection
- Block syntax validation

### 📋 Phase 2 (Future)

- Multi-template batch processing (6-15 templates)
- Resumable runs from the state file
- Screenshot comparison verification
- Block pattern extraction
- Complex component handling
- Style variation support

---

## Architecture

### Three-Phase Workflow

```
Phase 1: Discovery & Planning (1-2 min, interactive)
├── Ask for design system location
├── Extract complete design system (get_variable_defs)
├── Translate to theme.json structure
├── Survey templates (get_screenshot)
├── Create implementation plan
└── Present plan and wait for approval

↓ User: "Yes, proceed"

Phase 2: Autonomous Execution (5-90 min, zero interruptions)
├── Create theme.json from design system
├── FOR EACH template (1-15):
│   ├── Extract structure (get_design_context or get_screenshot)
│   ├── Generate FSE template HTML
│   ├── Apply theme.json tokens exclusively
│   ├── Validate automatically (hooks)
│   └── Continue to next (no prompts)
├── Create block patterns
├── Run quality checks
└── Generate comparison report

↓

Phase 3: Completion (< 1 min)
├── Present success summary
├── Link to comparison report
└── Provide next steps
```

### Figma MCP Integration

**Primary Tools:**
- `get_variable_defs` - Extract design tokens
- `get_design_context` - Extract component structure
- `get_screenshot` - Visual reference and fallback
- `get_metadata` - File structure overview

**Dual-Mode Support:**
- Desktop MCP (preferred): http://127.0.0.1:3845/mcp
- Remote MCP (fallback): https://mcp.figma.com/mcp

**Error Recovery:**
- get_design_context fails → get_screenshot analysis
- Missing token → add to theme.json
- Complex component → simplify to core blocks

### Autonomous Execution Integration

**Trigger Pattern:**
```javascript
// User approves plan
if (userApproval === "yes") {
  // Invoke executing-plans skill
  Skill("superpowers:executing-plans", planPath);
  // Agent works autonomously until complete
}
```

**Agent Configuration:**
- Model: Opus (advanced design interpretation)
- Permission mode: bypassPermissions
- Hooks: PostToolUse (validation), Stop (report generation)

---

## Success Metrics

### Performance Targets

- Single template: < 5 minutes
- 6 templates: < 30 minutes
- 15 templates: < 90 minutes
- Zero interruptions during execution

### Quality Targets

- 100% theme.json token usage (no hardcoded values)
- All security scans pass
- All coding standards pass
- All templates responsive
- All accessibility attributes present
- Pixel-perfect (within 5px tolerance)

---

## Usage Examples

### Example 1: Single Hero Section

```
User: "Convert this Figma hero section to FSE template"
      https://figma.com/design/abc123/Hero

Claude: [Extracts design system]
        [Creates plan]
        "Found hero section. I'll create theme.json + template.
        Proceed?"

User: "Yes"

Claude: [Works 3 minutes autonomously]
        "✅ Complete!
        - theme.json: 4 colors, 3 font sizes, 6 spacing tokens
        - templates/front-page.html created
        - 0 hardcoded values"
```

### Example 2: Multiple Templates

```
User: "Turn all designs in this Figma file into an FSE theme"
      https://figma.com/design/xyz789/Complete-Theme

Claude: "Where is your design system?"

User: "Design System page"

Claude: [Extracts complete design system]
        [Surveys templates]
        "Found 8 templates to convert:
        - Homepage, About, Services, Contact, Blog, Single, Archive, 404

        Will create complete FSE theme with theme.json.
        Proceed with autonomous conversion?"

User: "Yes"

Claude: [Works 45 minutes autonomously]
        "✅ Complete!
        - 8 templates created
        - 12 colors, 8 font sizes, 9 spacing tokens
        - 0 hardcoded values
        - All quality checks passed

        Report: .claude/reports/figma-fse-comparison.md"
```

---

## Testing

### Quick Test (MVP)

```bash
# Prerequisites
- Figma file with design system + 1 template
- Figma desktop app with Dev Mode enabled
- MCP server running

# Test command
"Convert this Figma hero section to FSE"

# Expected outcome (< 5 minutes)
- theme.json created
- templates/front-page.html created
- 0 hardcoded values
- 0 interruptions during execution
```

See [TESTING-GUIDE.md](./TESTING-GUIDE.md) for comprehensive testing instructions.

---

## Troubleshooting

### Common Issues

**Issue:** Claude doesn't invoke skill
- **Solution:** Use explicit trigger: "Use figma-to-fse-autonomous-workflow"

**Issue:** Figma MCP unreachable
- **Solution:** Check Figma desktop app open, Dev Mode enabled, MCP running

**Issue:** Hardcoded values in template
- **Solution:** Bug in mapping logic - report to developer

**Issue:** Claude stops during Phase 2
- **Solution:** Should NOT happen - this is a bug, report with details

See [TESTING-GUIDE.md](./TESTING-GUIDE.md#troubleshooting) for more details.

---

## Development Status

### ✅ Completed (Phase 1 MVP)

- [x] Skill orchestration workflow (SKILL.md)
- [x] Specialized agent (figma-fse-converter.md)
- [x] Implementation guide (design token extraction, template conversion)
- [x] Template examples (hero, cards, content, full template)
- [x] Autonomous execution integration (executing-plans)
- [x] Validation scripts (design tokens, templates)
- [x] Quality hooks (post-template validation)
- [x] Comparison report generation
- [x] Testing guide and documentation

### 📋 Todo (Phase 2)

- [ ] Test with single template (hero section)
- [ ] Test with multiple templates (6-15 templates)
- [x] Resumable runs from the state file (`.claude/pipeline/<theme>/state.json`)
- [ ] Add screenshot comparison verification
- [ ] Handle complex components (carousels, custom interactions)
- [ ] Extract reusable block patterns automatically
- [ ] Support style variations

---

## Related Files

**Skills:**
- `fse-block-theme-development` - FSE theme syntax and structure
- `block-pattern-creation` - Block pattern registration
- `wordpress-security-hardening` - Security best practices
- `superpowers:executing-plans` - Autonomous execution framework

**Agents:**
- `figma-fse-converter` - This skill's execution agent
- `frontend-developer` - General UI/UX implementation
- `test-writer-fixer` - PHP testing (for theme functions.php)

**Scripts:**
- `scripts/wordpress/` - WordPress-specific automation
- `scripts/figma-fse/` - Figma-to-FSE automation

---

## Contributing

### Adding New Features

1. Update SKILL.md with new workflow steps
2. Update IMPLEMENTATION-GUIDE.md with implementation details
3. Add examples to TEMPLATE-EXAMPLES.md if relevant
4. Update TESTING-GUIDE.md with new test scenarios
5. Test thoroughly before marking complete

### Reporting Issues

Include:
- Exact error message
- Figma file structure
- Expected vs actual behavior
- Steps to reproduce
- Test results template filled out

---

## License & Credits

**Created:** 2026-01-19
**Version:** 1.0.0 (Phase 1 MVP)
**Author:** figma-fse-converter development team
**Framework:** Claude Code WordPress Template
**Dependencies:** Figma MCP, WordPress FSE, superpowers plugin

---

**Status:** ✅ Phase 1 MVP complete - Ready for testing

**Next Step:** Run Test 1 from [TESTING-GUIDE.md](./TESTING-GUIDE.md) to verify single template conversion
