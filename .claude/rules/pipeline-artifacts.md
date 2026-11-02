---
paths:
  - ".claude/pipeline/**"
  - ".claude/figma-data/**"
  - ".claude/reports/**"
  - ".claude/workflows/**"
  - "tests/visual/**"
---

# Pipeline artifacts

- **`.claude/pipeline/<theme>/state.json`** is the record of a conversion run (figma, canva or indesign): source, phase, per-template status (`pending`, `running`, `done`, `needs-review`, `failed`), attempts, issues, errors, the design-system summary. The schema is in `.claude/skills/figma-to-fse-autonomous-workflow/SKILL.md` → Progress Tracking. Rewrite the whole file at every phase boundary and after every template; a fresh session resumes from the first template that is not `done`, and the SessionStart hook reports runs whose phase is not `done`. It is local to a checkout (`.claude/*` is gitignored); the theme under `themes/<slug>/` is the deliverable and the only part that is committed.
- **`.claude/workflows/fse-template-lanes.js`** runs Step 2.4 as one lane per template and writes the `templates` section of the state file through its last agent. It writes nothing else and starts no server.
- **`.claude/figma-data/<template>-attributes.json`** and **`attribute-comparison.json`** hold the Figma-to-token comparison data Step 2.4.7 saves; `scripts/figma-fse/generate-comparison-report.sh` reads them.
- **`.claude/reports/`** holds the completion and comparison reports (`figma-fse-completion.sh`, the agents' Stop hooks). Regenerated on each run, gitignored.
- **`tests/visual/baselines/`** is committed; `tests/visual/actual/`, `diffs/` and `report.json` are regenerated (`pnpm visual:capture`, `pnpm visual:diff`, `pnpm visual:update` to accept a new baseline, which is a human decision).
