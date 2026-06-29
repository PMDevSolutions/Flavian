# Agent Naming Guide

This guide helps you choose the right agent when more than one agent shares the same name. Name collisions happen when an installed Claude Code plugin ships an agent whose name matches another plugin's agent — or a local agent in `.claude/agents/`.

> **The `plugin/agent` references below are illustrative, not a claim about what is installed.** This template's own agents live in `.claude/agents/`; any additional agents come from whatever plugins you have installed (see `.claude/PLUGINS-REFERENCE.md` for the plugins this project documents). There is **no** local `code-reviewer` agent in this template. Verify what is actually available with `/plugin list` before assuming a specific `plugin/agent` exists.

## Resolving "code-reviewer" (and similar) collisions

If you have multiple plugins installed that each provide a similarly-named agent (for example, a `code-reviewer`), prefer the one most specific to your task. The common review situations are:

### General development review
For bug detection, security smells, code smells, and best-practice checks during active development. Favor a fast, read-only reviewer.

### Pull-request / merge review
For PR-specific analysis: cross-file impact, integration concerns, and merge readiness before shipping. Favor a comprehensive reviewer that can run tests and check dependencies.

### Plan-alignment review
For verifying that an implementation matches an agreed plan or architecture: requirement traceability and completeness. Favor a reviewer that can read both the plan and the diff.

**Quick rule:** match the agent to the moment — general coding vs. PR/merge vs. plan verification — and pick the most specific reviewer your installed plugins provide.

## Quick Decision Tree

```
Need to review code?
│
├─ Is there an implementation plan? ────> plan-alignment reviewer
│
├─ Is this for a PR/merge? ────────────> PR / merge reviewer
│
└─ General development review ─────────> general-purpose reviewer
```

## Other Name Collisions

The same "prefer the most specific" principle applies whenever agents overlap:

### Code simplifiers / refactorers
If more than one refactoring agent is available, use the one intended to run **after** a review — it refactors the flagged code while preserving behavior.

### Test agents
This template ships a local **test-writer-fixer** (writes tests, runs them, fixes failures). If a plugin also provides a test-coverage analyzer, treat them as complementary: active fixing vs. passive analysis.

### Frontend agents
This template ships a local **frontend-developer** (full-stack FSE implementation). If a plugin also provides a UI/UX design agent, design first, then implement.

## When in Doubt

1. Run `/plugin list` to see which plugins — and therefore which plugin agents — are actually installed.
2. Check the decision tree above.
3. Prefer the more specific agent for your task (e.g., a PR reviewer for PRs).
4. Ask Claude Code: "Which agent should I use for [task]?"

---

**Last Updated:** 2026-06-28
