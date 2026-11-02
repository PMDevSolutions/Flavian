# Autonomous Execution Integration

**Purpose:** Explains how figma-to-fse-autonomous-workflow integrates with superpowers:executing-plans for uninterrupted multi-template conversion

**Status:** Phase 1 MVP implementation ready

---

## The Autonomous Workflow Pattern

### Three-Phase Architecture

```
┌─────────────────────────────────────────────────────┐
│ Phase 1: Discovery & Planning (Main Agent)         │
│ - Interactive, requires user input                  │
│ - Duration: 1-2 minutes                             │
├─────────────────────────────────────────────────────┤
│ 1. Ask for design system location                  │
│ 2. Extract complete design system (get_variable_defs) │
│ 3. Translate to theme.json structure                │
│ 4. Survey templates (get_screenshot)                │
│ 5. Create implementation plan (superpowers:writing-plans) │
│ 6. Present plan to user                             │
│ 7. Wait for approval                                │
└─────────────────────────────────────────────────────┘
                         ↓
              User: "Yes, proceed"
                         ↓
┌─────────────────────────────────────────────────────┐
│ Phase 2: Autonomous Execution (figma-fse-converter) │
│ - Zero user interaction required                    │
│ - Duration: 5-90 minutes (depends on template count) │
├─────────────────────────────────────────────────────┤
│ FOR EACH TEMPLATE (1-15):                           │
│   1. Extract structure (get_design_context)         │
│   2. Generate FSE template HTML                     │
│   3. Apply theme.json tokens exclusively            │
│   4. Run validation hooks automatically             │
│   5. Continue to next (NO "should I continue?")     │
│                                                     │
│ THEN:                                               │
│   1. Create block patterns                          │
│   2. Run quality checks                             │
│   3. Generate comparison report                     │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ Phase 3: Completion (Main Agent)                    │
│ - Present results to user                           │
│ - Duration: < 1 minute                              │
├─────────────────────────────────────────────────────┤
│ 1. Show summary (templates created, tokens used)    │
│ 2. Link to comparison report                        │
│ 3. Provide next steps                               │
└─────────────────────────────────────────────────────┘
```

---

## How executing-plans Integration Works

### Current Implementation Status

✅ **Phase 1 Complete:**
- figma-to-fse-autonomous-workflow skill created
- Design system extraction workflow documented
- Template survey process defined
- Plan generation approach specified

✅ **Phase 2 Foundation Ready:**
- figma-fse-converter agent created
- Agent configured with bypassPermissions for autonomy
- Implementation guide provides step-by-step instructions
- Template examples show expected output

⏳ **Executing-Plans Integration (How to trigger):**

When user approves plan, the main agent should invoke executing-plans:

```
Phase 1 complete → User: "Proceed"

Main Agent:
"I'll now execute this plan autonomously using the figma-fse-converter agent."

[Invoke Skill tool]
skill: "superpowers:executing-plans"
args: (reference to the implementation plan created in Phase 1)

This hands off to executing-plans skill, which:
1. Reads the plan
2. Executes tasks in batches
3. Reports back when complete
```

### Agent Behavior During Autonomous Phase

**The figma-fse-converter agent is configured to:**

1. **Work continuously without prompts**
   - No "should I continue?" during execution
   - Only stop if completely blocked (MCP unreachable, file structure missing)

2. **Recover from errors autonomously**
   - get_design_context fails → fallback to get_screenshot
   - Missing token → add to theme.json
   - Complex component → use simpler blocks
   - Log errors but continue

3. **Track progress in the state file** (`.claude/pipeline/<theme>/state.json`; TodoWrite is not offered on current models)
   - Mark a template `running` before starting and `done` after finishing
   - Rewrite the file after every template and at every phase boundary
   - Update the user only at checkpoints (every 3-5 templates)

4. **Validate automatically via hooks**
   - Post-template hook runs after each template
   - Validates syntax, checks for hardcoded values
   - Scans security and coding standards
   - Reports issues but doesn't block

5. **Resume from the state file in long sessions**
   - The state file is the checkpoint; nothing is saved to episodic memory
   - If context approaches the limit, make sure the file is current and inform the user
   - A fresh session resumes from the first template that is not `done`

---

## Detailed Integration Steps

### Step 1: Main Agent Creates Plan (Phase 1)

```javascript
// Pseudo-code for main agent Phase 1 behavior

async function phase1_discovery(figmaUrl) {
  // 1. Extract file key and node IDs from URL
  const {fileKey, nodeId} = parseFigmaUrl(figmaUrl);

  // 2. Ask for design system location
  const designSystemLocation = await askUser(
    "Where is your design system in the Figma file?"
  );

  // 3. Extract complete design system
  const designTokens = await extractDesignSystem(designSystemLocation);

  // 4. Translate to theme.json structure
  const themeJsonPreview = translateToThemeJson(designTokens);

  // 5. Survey templates
  const templates = await surveyTemplates(fileKey);

  // 6. Create implementation plan
  const plan = await createImplementationPlan({
    designTokens,
    themeJsonPreview,
    templates
  });

  // 7. Present to user
  presentPlan(plan);

  // 8. Wait for approval
  const approval = await waitForUserInput();

  if (approval === "yes") {
    // Trigger Phase 2 (autonomous execution)
    return await triggerAutonomousExecution(plan);
  }
}
```

### Step 2: Trigger Autonomous Execution

**Current approach (MVP):**

```markdown
User: "Yes, proceed"

Main Agent response:
"I'll now execute this plan autonomously. The figma-fse-converter agent
will work continuously through all templates without interruption."

[Invoke Skill tool]
skill: "superpowers:executing-plans"
args: Path to plan file (e.g., ".claude/plans/figma-fse-plan.md")

The executing-plans skill then:
1. Loads the plan
2. Follows the implementation steps
3. Uses figma-fse-converter agent capabilities
4. Reports when complete
```

**Future enhancement (Phase 2):**

```markdown
Alternatively, directly invoke figma-fse-converter agent with plan:

[Invoke Task tool]
subagent_type: "figma-fse-converter"
description: "Convert Figma templates to FSE"
prompt: "Execute this implementation plan: [plan details]"
run_in_background: false (block until complete)
```

### Step 3: Agent Executes Plan (Phase 2)

```javascript
// Pseudo-code for figma-fse-converter agent during autonomous execution

async function phase2_execution(plan) {
  // NO user interaction during this entire function

  try {
    // Task 1: Create theme.json
    await createThemeJson(plan.designTokens, plan.themeName);
    markTaskComplete("Create theme.json");

    // Task 2: Create theme structure
    await createThemeStructure(plan.themeName);
    markTaskComplete("Create theme structure");

    // Task 3: Convert templates (LOOP without prompting)
    for (const template of plan.templates) {
      try {
        // 3a. Extract structure
        const structure = await extractTemplateStructure(template.nodeId);

        // 3b. Generate FSE template
        const html = generateFSETemplate(structure, template.name);

        // 3c. Write to file
        await writeTemplate(html, template.wpFileName);

        // 3d. Hooks run automatically (validation, security, standards)
        // These hooks are configured in agent.md PostToolUse section

        // 3e. Mark complete and continue
        markTaskComplete(`Convert ${template.name}`);

        // CRITICAL: No "should I continue?" prompt here
        // Just proceed to next template

      } catch (templateError) {
        // Error recovery: Log and continue
        logError(templateError);
        tryFallback(template);
        // Don't stop - keep going
      }
    }

    // Task 4: Create block patterns
    await createBlockPatterns(plan.templates);
    markTaskComplete("Create block patterns");

    // Task 5: Run quality checks
    await runQualityChecks(plan.themeName);
    markTaskComplete("Run quality checks");

    // Task 6: Generate comparison report
    await generateComparisonReport(plan.themeName);
    markTaskComplete("Generate report");

    // Return to main agent for Phase 3
    return {
      success: true,
      templatesCreated: plan.templates.length,
      themePath: `themes/${plan.themeName}`
    };

  } catch (blockerError) {
    // Only stop for complete blockers
    return {
      success: false,
      error: blockerError.message,
      needsUserIntervention: true
    };
  }
}
```

### Step 4: Main Agent Presents Results (Phase 3)

```javascript
// Pseudo-code for main agent Phase 3 behavior

async function phase3_completion(executionResult) {
  if (executionResult.success) {
    presentSuccessMessage({
      templatesCreated: executionResult.templatesCreated,
      themePath: executionResult.themePath,
      reportPath: ".claude/reports/figma-fse-comparison.md"
    });

    suggestNextSteps();
  } else {
    presentErrorMessage(executionResult.error);
    askForUserGuidance();
  }
}
```

---

## Error Recovery Patterns

### Pattern 1: Non-Blocking Errors

**Errors that should NOT stop execution:**

- get_design_context fails (annotations) → Use get_screenshot fallback
- Missing design token → Add to theme.json on the fly
- Component mapping unclear → Use simpler block structure
- Validation warning → Log but continue
- Single template fails → Log error, continue to next template

**Implementation:**

```javascript
try {
  await convertTemplate(template);
} catch (error) {
  logError(`Template ${template.name} failed: ${error.message}`);

  // Try fallback
  try {
    await convertTemplateFromScreenshot(template);
  } catch (fallbackError) {
    logError(`Fallback also failed for ${template.name}`);
    // Continue to next template anyway
  }
}

// ALWAYS continue to next iteration
```

### Pattern 2: Blocking Errors

**Errors that SHOULD stop execution:**

- Figma MCP completely unreachable (both desktop + remote)
- WordPress theme directory doesn't exist
- Can't write files (permissions issue)
- theme.json generation completely fails

**Implementation:**

```javascript
try {
  await connectToFigmaMCP();
} catch (error) {
  // This is a blocker - can't proceed
  throw new BlockerError("Figma MCP unreachable. Cannot extract design system.");
}

// If we reach here, continue with execution
```

---

## Context Management

### Long Session Checkpointing

**Problem:** Converting 15 templates can exhaust context window

**Solution:** Episodic memory checkpoints every 3 templates

```javascript
async function convertTemplatesWithCheckpointing(templates) {
  const CHECKPOINT_INTERVAL = 3;

  for (let i = 0; i < templates.length; i++) {
    await convertTemplate(templates[i]);

    // Checkpoint every 3 templates
    if ((i + 1) % CHECKPOINT_INTERVAL === 0) {
      await saveCheckpoint({
        completed: templates.slice(0, i + 1),
        remaining: templates.slice(i + 1),
        designTokenMappings: getDesignTokenMappings(),
        themeName: currentTheme.name
      });
    }
  }
}

// If context limit reached mid-execution
async function resumeFromCheckpoint() {
  const checkpoint = await loadLatestCheckpoint();

  console.log(`Resuming from checkpoint: ${checkpoint.completed.length} templates done`);

  // Continue with remaining templates
  for (const template of checkpoint.remaining) {
    await convertTemplate(template);
  }
}
```

---

## Testing the Integration

### Test 1: Single Template (MVP Verification)

```
Setup:
- Figma file with design system + 1 hero section

User: "Convert this Figma hero section to FSE"

Expected:
✅ Phase 1: Design system extracted, plan created (< 2 min)
✅ Phase 2: Template converted autonomously (< 5 min)
✅ Phase 3: Results presented with report
✅ NO "should I continue?" prompts during Phase 2
✅ All validation hooks ran automatically
✅ Zero hardcoded values in output
```

### Test 2: Multiple Templates (Full Autonomous Test)

```
Setup:
- Figma file with design system + 6 templates

User: "Turn all Figma designs into FSE theme"

Expected:
✅ Phase 1: Complete design system, all 6 templates surveyed (< 3 min)
✅ Phase 2: All 6 templates converted continuously (< 30 min)
✅ NO interruptions during Phase 2
✅ Checkpoint saved after template 3
✅ All templates validated
✅ Comparison report generated
✅ Phase 3: Success summary with next steps
```

### Test 3: Error Recovery

```
Setup:
- Figma file with design system + 3 templates
- Template 2 has annotations (causes get_design_context to fail)

User: "Convert all templates"

Expected:
✅ Template 1: Converts successfully
✅ Template 2: get_design_context fails
✅ Template 2: Automatically falls back to get_screenshot
✅ Template 2: Converts from visual analysis
✅ Template 3: Converts successfully
✅ NO stop during Template 2 error
✅ Error logged in report
✅ All 3 templates completed
```

---

## Success Metrics

**Phase 1 (Discovery) Complete When:**
- ✅ Design system extracted wholesale (ALL tokens)
- ✅ theme.json preview generated
- ✅ All templates identified (with node IDs)
- ✅ Implementation plan created
- ✅ User approved plan

**Phase 2 (Execution) Complete When:**
- ✅ theme.json written to file
- ✅ All N templates converted (N of N)
- ✅ Zero "should I continue?" prompts issued
- ✅ All validation hooks completed
- ✅ Comparison report generated

**Phase 3 (Completion) Complete When:**
- ✅ Success summary presented to user
- ✅ Report link provided
- ✅ Next steps suggested

**Quality Metrics:**
- 100% theme.json token usage (zero hardcoded values)
- All security scans passed
- All coding standards passed
- All templates responsive
- All accessibility attributes present

---

## Current Status

**✅ Implemented (Phase 1 MVP):**
- figma-to-fse-autonomous-workflow skill (orchestration)
- figma-fse-converter agent (execution)
- Implementation guide (design token extraction + template conversion)
- Template examples (reference patterns)
- Validation scripts (quality gates)
- Hooks (post-template validation)

**⏳ Ready for Testing:**
- Single template conversion workflow
- Design token extraction
- FSE template generation
- Autonomous execution pattern

**📋 Phase 2 (Future):**
- Multi-template batch processing (6-15 templates)
- Episodic memory checkpointing
- Screenshot comparison verification
- Block pattern extraction
- Complex component handling

---

## Integration Checklist

Before considering autonomous execution ready:

- [x] figma-to-fse-autonomous-workflow skill created
- [x] figma-fse-converter agent created
- [x] Agent configured with bypassPermissions mode
- [x] Implementation guide complete
- [x] Template examples provided
- [x] Validation scripts created
- [x] Hooks configured
- [ ] Test with single template (hero section)
- [ ] Verify zero interruptions during execution
- [ ] Verify all validation hooks run automatically
- [ ] Verify error recovery works (fallback patterns)
- [ ] Test with multiple templates (6 templates)
- [ ] Verify resumption from the state file

---

**End of Autonomous Execution Integration Guide**

**Next Step:** Test single template conversion to verify MVP workflow
