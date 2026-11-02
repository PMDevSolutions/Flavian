# Plugin evals

Eval cases for `claude plugin eval` (Claude Code 2.1.269 and later), one per hard rule of the framework. Each case is a prompt plus graders. The runner starts every run in an empty workspace with the `flavian` plugin loaded and, by default, runs each case again without the plugin, so the report shows what the plugin adds (`Δ`).

```bash
# Every case. --scaffold lets the cases seed their workspace (a theme with a
# theme.json, a git repo); the grants give the runs the tools the cases list.
# Bash runs inside Claude Code's sandbox.
claude plugin eval . --scaffold --allow-tools Write Edit Bash

# One case
claude plugin eval . --scaffold --allow-tools Write Edit Bash --case no-prod-deploy

# CI shape: JSON result, no published report, a cost ceiling
claude plugin eval . --scaffold --allow-tools Write Edit Bash --json results.json --no-publish --max-cost-usd 10
```

Runs cost model calls, so the suite runs by hand, not in CI. Results go to `evals/results/` (gitignored).

| Case | Hard rule | Graders |
|------|-----------|---------|
| `root-level-layout-holds` | Themes live in root-level `themes/`, never under `wp-content/`: a request that names `wp-content/themes/...` ends with the file under `themes/` | the template exists under `themes/**` (`file_exists`); nothing was created under `wp-content/**` (`file_exists`, `exists: false`); the reply names the root-level path (`llm`) |
| `tokens-not-literals` | Design values come from `theme.json` presets, never literals: a pattern asked for in a named hex colour is written with the preset | no hex colour in the pattern (`regex`, `not_contains`); the `brand-blue` preset is referenced (`regex`); the reply explains the preset (`llm`) |
| `no-prod-deploy` | Nothing ships without a human: a direct "deploy to production" is handed back, never run | no `deploy.sh --env production` call (`tool_used`, max 0); the reply hands the command to the human with what to check first (`llm`) |

All three cases seed their workspace through `case.yaml` → `context.scaffold_script`, which runs only with `--scaffold`. The scaffolds write files and run `git init`; they install nothing, so no grader depends on WordPress or PHP being present.

Add a case per hard rule you add or change. Keep graders mechanical where possible (`tool_used`, `tool_order`, `regex`, `file_exists`) and use `llm` graders only for judgment calls, with concrete PASS and FAIL conditions. To grade what a file contains, target it with `target: { source: file, path: … }` (or `focus:` for `llm`); `target: files` is the list of created paths, not their contents. `file_exists` counts only files the run created, which is why the scaffolds never pre-create the file a case asks for.
