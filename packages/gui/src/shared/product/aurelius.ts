/**
 * Ported from PMDevSolutions/Aurelius packages/gui (main 86bcc99, 2026-11-06) for the Trajan
 * reconciliation (#187), quote style aside. Keep it in step with the fork until Aurelius#149
 * retires the fork; its Build-from-Figma flow, second prerequisite step and script-backed
 * wizard render here once the reconciliation plan ports them.
 *
 * The Aurelius product manifest — the single declarative catalog of everything
 * product-specific the GUI shows and runs. Aurelius turns designs into tested
 * React/Vue/Svelte/Expo apps, so the catalog is: a prerequisite check, the
 * project scaffolder (`scripts/setup-project.sh`), the autonomous Figma pipeline
 * (the `/build-from-figma` slash command run through headless Claude Code), and
 * the visual-QA scripts under `scripts/`. Changing the app's catalog means editing
 * this object; the engine is untouched.
 *
 * Command notes:
 *   - prereq runs `bash scripts/check-prerequisites.sh`; exit 0 OR 1 is task-success.
 *   - wizard runs `bash scripts/setup-project.sh <name> --renderer <id> [--dry-run]`;
 *     `{dryRun}` is either '--dry-run' or '' (an empty placeholder-only arg is dropped
 *     once the reconciliation plan's Task 3a lands in fillTemplate).
 *   - pipeline: `claude -p "/build-from-figma <url>"` — the same slash command a
 *     terminal user would type; Claude Code runs phases 0–9 autonomously.
 *   - qa steps each take the running app's URL as `{url}` and write their artifacts
 *     under `.claude/visual-qa/`, which the QA screen then renders.
 */
import type { ProductManifest, ProductStep } from './manifest';

const project = { kind: 'project' } as const;

/** Helper to keep QA step ids honestly typed and `taskKind` derived from the id. */
const qa = (
  id: string,
  label: string,
  cta: string,
  script: string,
  argsTemplate: readonly string[],
): ProductStep => ({
  id,
  label,
  cta,
  taskKind: `qa:${id}`,
  command: { exec: 'bashScript', script, argsTemplate },
  prerequisites: [project],
});

export const aureliusManifest: ProductManifest = {
  id: 'aurelius',
  displayName: 'Aurelius',

  project: {
    markers: ['scripts/setup-project.sh', '.claude/pipeline.config.json'],
    packageName: 'aurelius',
    invalidReason:
      'Not an Aurelius project — expected scripts/setup-project.sh, .claude/pipeline.config.json, and a package.json named "aurelius".',
    notFoundReason: 'No Aurelius project found while walking up from the start directory.',
    selectTitle: 'Select your Aurelius project folder',
    selectMessage: 'Choose the directory that contains scripts/ and .claude/pipeline.config.json.',
  },

  screens: [
    {
      id: 'prereq',
      navLabel: 'Prerequisites',
      title: 'Prerequisites',
      prerequisites: [project],
      steps: [
        {
          id: 'check',
          label: 'Re-check',
          taskKind: 'prereq-check',
          command: { exec: 'bashScript', script: 'scripts/check-prerequisites.sh' },
          parser: 'prereq',
          // Exit 1 ("requirements missing") is a valid result, not a task failure.
          successExitCodes: [0, 1],
          prerequisites: [project],
        },
        {
          id: 'playwright',
          label: 'Install Playwright browsers',
          cta: 'Install Playwright browsers',
          taskKind: 'prereq:playwright',
          command: { exec: 'bashScript', script: 'scripts/setup-playwright.sh' },
          prerequisites: [project],
        },
      ],
    },

    {
      id: 'wizard',
      navLabel: 'Setup wizard',
      title: 'Setup wizard',
      prerequisites: [project],
      extras: {
        frameworks: [
          { id: 'nextjs', label: 'Next.js' },
          { id: 'vite', label: 'Vite' },
          { id: 'astro', label: 'Astro' },
          { id: 'sveltekit', label: 'SvelteKit' },
          { id: 'expo', label: 'Expo' },
        ],
      },
      steps: [
        {
          id: 'create',
          label: 'Create project',
          cta: 'Create project',
          taskKind: 'init',
          command: {
            exec: 'bashScript',
            script: 'scripts/setup-project.sh',
            argsTemplate: ['{name}', '--renderer', '{renderer}', '{dryRun}'],
          },
          prerequisites: [project],
        },
      ],
    },

    {
      id: 'pipeline',
      navLabel: 'Build from Figma',
      title: 'Build from Figma',
      prerequisites: [project],
      extras: {
        docs: { figma: 'docs/figma-to-react/README.md' },
        links: [
          {
            label: 'Figma Dev Mode',
            url: 'https://help.figma.com/hc/en-us/articles/15023124644247',
          },
        ],
      },
      steps: [
        {
          id: 'figma',
          label: 'Figma',
          cta: 'Build app',
          taskKind: 'pipeline:figma',
          command: { exec: 'claude', argsTemplate: ['-p', '/build-from-figma {figmaUrl}'] },
          prerequisites: [
            project,
            {
              kind: 'tool',
              tool: 'claude',
              hint: 'Runs the /build-from-figma pipeline in a headless Claude Code session with Figma MCP access.',
            },
          ],
        },
      ],
    },

    {
      id: 'qa',
      navLabel: 'Visual QA',
      title: 'Visual QA',
      prerequisites: [project],
      steps: [
        qa('baselines', 'Capture baselines', 'Capture baselines', 'scripts/capture-baselines.sh', [
          '{url}',
        ]),
        qa('regression', 'Pixel-diff regression', 'Run regression', 'scripts/regression-test.sh', [
          '{url}',
        ]),
        qa(
          'responsive',
          'Responsive screenshots',
          'Check responsive',
          'scripts/check-responsive.sh',
          ['{url}'],
        ),
        qa('dark-mode', 'Dark mode', 'Check dark mode', 'scripts/check-dark-mode.sh', ['{url}']),
        qa(
          'cross-browser',
          'Cross-browser compare',
          'Compare browsers',
          'scripts/cross-browser-baseline.sh',
          ['compare', '{url}'],
        ),
      ],
    },
  ],
};
