/**
 * Ported verbatim from PMDevSolutions/Vespasian packages/gui (main ed0696c, 2026-11-04) for the
 * Trajan reconciliation (#187). Keep it in step with the fork until Vespasian#40 retires the
 * fork; the `site` screen renders here once the reconciliation plan ports its panel.
 *
 * The Vespasian product manifest — the single declarative catalog of everything
 * product-specific the GUI shows and runs. Vespasian converts designs
 * (Figma · Canva · InDesign) into a live **Wix Studio** site: there is no local
 * server stack to supervise, so instead of a Docker screen the manifest declares
 * a **Wix site** screen that drives `bin/vespasian.mjs` subcommands (site list /
 * site use / apply / publish), plus the shared prereq / wizard / pipeline / QA
 * screens. Changing the app's catalog means editing this object; the engine is
 * untouched.
 *
 * Command notes:
 *   - prereq runs `bash scripts/check-prerequisites.sh`; exit 0 OR 1 is task-success.
 *   - site maps 1:1 to `node bin/vespasian.mjs <subcommand>` (the CLI loads .env itself).
 *   - `vespasian login --editor` is deliberately NOT a step: it needs an interactive
 *     terminal (consent prompt + headed login + a human pressing Enter), so the site
 *     panel surfaces session state and points at the terminal command instead.
 *   - pipeline: Figma/Canva ⇒ headless `claude -p` (the Claude-Code-driven flows),
 *     InDesign ⇒ the deterministic `node bin/vespasian.mjs pipeline indesign …`,
 *     which compiles a BuildPlan under .vespasian/plans/<slug>/.
 *   - qa runs the pnpm scripts via `bash -c`.
 *   - wizard imports scripts/init/{default-resolver,apply}.mjs and runs apply() in-process.
 */
import type { PipelineKind } from '../types/pipeline';
import type { QaScript } from '../types/qa';
import type { SiteCommand } from '../types/site';
import type { ProductManifest } from './manifest';

/** Headless-Claude instruction for a Figma conversion. `{figmaUrl}`/`{slug}` are filled at run time. */
const FIGMA_PROMPT =
  'Convert the Figma design at {figmaUrl} into a live Wix Studio site using the ' +
  'figma-to-wix-autonomous-workflow. Use the slug "{slug}" (plan artifacts under ' +
  '.vespasian/plans/{slug}). Work autonomously: extract the design tokens, compile ' +
  'the BuildPlan, apply it (official APIs first, the wix-site-builder agent for ' +
  'editor steps), then run visual QA and record every loss in the FidelityReport.';

/** Headless-Claude instruction for a Canva conversion. `{canvaExport}`/`{slug}` are filled at run time. */
const CANVA_PROMPT =
  'Convert the Canva export at {canvaExport} into a live Wix Studio site using the ' +
  'canva-to-wix-autonomous-workflow. Use the slug "{slug}" (plan artifacts under ' +
  '.vespasian/plans/{slug}). Work autonomously: extract the design tokens, compile ' +
  'the BuildPlan, apply it (official APIs first, the wix-site-builder agent for ' +
  'editor steps), then run visual QA and record every loss in the FidelityReport.';

/** Helper to keep site step ids honestly typed against the shared vocabulary. */
const site = (
  id: SiteCommand,
  label: string,
  group: 'account' | 'target' | 'build',
  argsTemplate: readonly string[],
) =>
  ({
    id,
    label,
    group,
    taskKind: `site:${id}`,
    command: { exec: 'nodeBin', script: 'bin/vespasian.mjs', argsTemplate },
  }) as const;

export const vespasianManifest: ProductManifest = {
  id: 'vespasian',
  displayName: 'Vespasian',

  project: {
    markers: ['bin/vespasian.mjs', 'scripts/check-prerequisites.sh'],
    packageName: 'vespasian',
    invalidReason:
      'Not a Vespasian project — expected bin/vespasian.mjs, scripts/check-prerequisites.sh, and a package.json named "vespasian".',
    notFoundReason: 'No Vespasian project found while walking up from the start directory.',
    selectTitle: 'Select your Vespasian project folder',
    selectMessage: 'Choose the directory that contains bin/vespasian.mjs and scripts/.',
  },

  screens: [
    {
      id: 'prereq',
      navLabel: 'Prerequisites',
      title: 'Prerequisites',
      prerequisites: [{ kind: 'project' }],
      steps: [
        {
          id: 'check',
          label: 'Re-check',
          taskKind: 'prereq-check',
          command: { exec: 'bashScript', script: 'scripts/check-prerequisites.sh' },
          parser: 'prereq',
          // Exit 1 ("requirements missing") is a valid result, not a task failure.
          successExitCodes: [0, 1],
          prerequisites: [{ kind: 'project' }],
        },
      ],
    },

    {
      id: 'wizard',
      navLabel: 'Setup wizard',
      title: 'Setup wizard',
      prerequisites: [{ kind: 'project' }],
      steps: [
        {
          id: 'apply',
          label: 'Run setup',
          taskKind: 'init',
          // The engine imports <module>/default-resolver.mjs + <module>/apply.mjs and
          // runs apply() in-process — the same code path as `pnpm run init`.
          command: { exec: 'module', module: 'scripts/init' },
          prerequisites: [{ kind: 'project' }],
        },
      ],
    },

    {
      id: 'site',
      navLabel: 'Wix site',
      title: 'Wix site',
      prerequisites: [{ kind: 'project' }],
      extras: {
        links: [
          { label: 'Wix dashboard', url: 'https://manage.wix.com/' },
          { label: 'API keys', url: 'https://manage.wix.com/account/api-keys' },
        ],
      },
      steps: [
        {
          ...site('list', 'List sites', 'account', ['site', 'list']),
          prerequisites: [
            { kind: 'project' },
            {
              kind: 'tool',
              tool: 'wix-api-key',
              hint: 'Needs WIX_API_KEY + WIX_ACCOUNT_ID in .env (or VESPASIAN_DRY_RUN=1).',
            },
          ],
        },
        {
          ...site('use', 'Connect site', 'target', ['site', 'use', '{siteId}']),
          cta: 'Connect',
        },
        {
          ...site('apply', 'Apply plan', 'build', ['apply', '{plan}']),
          cta: 'Apply',
          prerequisites: [
            { kind: 'project' },
            {
              kind: 'service',
              service: 'wix-site',
              hint: 'Applying needs a target site — connect or create one first.',
            },
          ],
        },
        {
          ...site('publish', 'Publish', 'build', ['publish']),
          prerequisites: [
            { kind: 'project' },
            {
              kind: 'service',
              service: 'wix-site',
              hint: 'Publishing needs a target site (WIX_SITE_ID in .env).',
            },
          ],
        },
      ],
    },

    {
      id: 'pipeline',
      navLabel: 'Convert design',
      title: 'Convert design',
      prerequisites: [{ kind: 'project' }],
      extras: {
        docs: {
          figma: 'docs/figma-to-wix/README.md',
          canva: 'docs/canva-to-wix/README.md',
          indesign: 'docs/pipelines/indesign.md',
        },
      },
      steps: [
        {
          id: 'figma' satisfies PipelineKind,
          label: 'Figma',
          taskKind: 'pipeline:figma',
          command: { exec: 'claude', argsTemplate: ['-p', FIGMA_PROMPT] },
          prerequisites: [
            { kind: 'project' },
            {
              kind: 'tool',
              tool: 'claude',
              hint: 'Figma conversion opens a headless Claude Code session with Figma access.',
            },
          ],
        },
        {
          id: 'canva' satisfies PipelineKind,
          label: 'Canva',
          taskKind: 'pipeline:canva',
          command: { exec: 'claude', argsTemplate: ['-p', CANVA_PROMPT] },
          prerequisites: [
            { kind: 'project' },
            {
              kind: 'tool',
              tool: 'claude',
              hint: 'Canva conversion opens a headless Claude Code session.',
            },
          ],
        },
        {
          id: 'indesign' satisfies PipelineKind,
          label: 'InDesign',
          taskKind: 'pipeline:indesign',
          command: {
            exec: 'nodeBin',
            script: 'bin/vespasian.mjs',
            argsTemplate: ['pipeline', 'indesign', '{file}', '--slug', '{slug}'],
          },
          prerequisites: [{ kind: 'project' }],
        },
      ],
    },

    {
      id: 'qa',
      navLabel: 'Visual QA',
      title: 'Visual QA',
      prerequisites: [{ kind: 'project' }],
      steps: [
        {
          id: 'visual:diff' satisfies QaScript,
          label: 'Visual diff',
          cta: 'Run visual diff',
          taskKind: 'qa:visual:diff',
          command: { exec: 'bashCommand', command: 'pnpm run visual:diff' },
          prerequisites: [
            { kind: 'project' },
            {
              kind: 'service',
              service: 'wix-site',
              hint: 'QA screenshots a published Wix site — publish first (WIX_SITE_ID set).',
            },
          ],
        },
        {
          id: 'lighthouse:run' satisfies QaScript,
          label: 'Lighthouse',
          cta: 'Run Lighthouse',
          taskKind: 'qa:lighthouse:run',
          command: { exec: 'bashCommand', command: 'pnpm run lighthouse:run' },
          prerequisites: [
            { kind: 'project' },
            {
              kind: 'service',
              service: 'wix-site',
              hint: 'Lighthouse audits the published Wix site — publish first.',
            },
          ],
        },
      ],
    },
  ],
};
