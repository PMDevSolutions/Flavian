/**
 * The Flavian product manifest — an exact, declarative reproduction of the behaviour
 * the GUI shipped hard-coded through v1.10.0. Every screen, step, command, parser and
 * piece of project-detection copy that used to live scattered across core/main/renderer
 * now originates here. Changing the app's catalog means editing this object; the engine
 * is untouched.
 *
 * Faithfulness notes (these MUST match the prior hard-coded values byte-for-byte to keep
 * the user-visible behaviour identical):
 *   - prereq runs `bash scripts/check-prerequisites.sh`; exit 0 OR 1 is task-success.
 *   - docker maps 1:1 to `bash wordpress-local.sh <subcommand> [arg]`.
 *   - qa runs the pnpm scripts via `bash -c`.
 *   - pipeline: Figma ⇒ headless `claude -p`, InDesign ⇒ `node bin/flavian.mjs …`,
 *     Canva ⇒ the wizard's Canva path (delegate).
 *   - wizard imports scripts/init/{default-resolver,apply}.mjs and runs apply() in-process.
 */
import type { DockerCommand } from '../types/docker';
import type { PipelineKind } from '../types/pipeline';
import type { QaScript } from '../types/qa';
import type { ProductManifest } from './manifest';

/** Headless-Claude instruction for a Figma conversion. `{figmaUrl}`/`{slug}` are filled at run time. */
const FIGMA_PROMPT =
  'Convert the Figma design at {figmaUrl} into a WordPress FSE block theme using ' +
  'the figma-to-fse-autonomous-workflow. Use the theme slug "{slug}" and write the ' +
  'theme to themes/{slug}. Work autonomously through to a validated theme.';

/** Helper to keep docker step ids honestly typed against the shared vocabulary. */
const docker = (
  id: DockerCommand,
  label: string,
  group: 'lifecycle' | 'logs' | 'themes',
  argsTemplate: readonly string[],
) =>
  ({
    id,
    label,
    group,
    taskKind: `docker:${id}`,
    command: { exec: 'bashScript', script: 'wordpress-local.sh', argsTemplate },
  }) as const;

export const flavianManifest: ProductManifest = {
  id: 'flavian',
  displayName: 'Flavian',

  project: {
    markers: ['wordpress-local.sh', 'scripts/check-prerequisites.sh'],
    packageName: 'flavian',
    invalidReason:
      'Not a Flavian project — expected wordpress-local.sh, scripts/check-prerequisites.sh, and a package.json named "flavian".',
    notFoundReason: 'No Flavian project found while walking up from the start directory.',
    selectTitle: 'Select your Flavian project folder',
    selectMessage: 'Choose the directory that contains wordpress-local.sh and scripts/.',
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
      extras: {
        themeStarters: [
          { value: 'blank', label: 'Blank FSE theme' },
          { value: 'flavian-shop', label: 'flavian-shop (WooCommerce-ready)' },
          { value: 'canva', label: 'Canva export → FSE theme' },
          { value: 'figma', label: 'Figma import placeholder' },
          { value: 'indesign', label: 'InDesign import placeholder' },
        ],
      },
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
      id: 'docker',
      navLabel: 'WordPress',
      title: 'WordPress (Docker)',
      prerequisites: [{ kind: 'project' }],
      extras: {
        links: [
          { label: 'Site', url: 'http://localhost:8080' },
          { label: 'wp-admin', url: 'http://localhost:8080/wp-admin' },
          { label: 'Database (phpMyAdmin)', url: 'http://localhost:8081' },
        ],
      },
      steps: [
        docker('build', 'Build', 'lifecycle', ['build']),
        docker('start', 'Start', 'lifecycle', ['start']),
        docker('stop', 'Stop', 'lifecycle', ['stop']),
        docker('restart', 'Restart', 'lifecycle', ['restart']),
        docker('install', 'Install WP', 'lifecycle', ['install']),
        // `label` is the running-task heading ("Streaming logs"); `cta` is the button text.
        { ...docker('logs', 'Streaming logs', 'logs', ['logs']), cta: 'Stream logs' },
        docker('list-themes', 'List themes', 'themes', ['list-themes']),
        {
          ...docker('activate-theme', 'Activate', 'themes', ['activate-theme', '{theme}']),
          prerequisites: [
            { kind: 'project' },
            { kind: 'service', service: 'wordpress', hint: 'Start WordPress first, then activate a theme.' },
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
          figma: 'docs/figma-to-wordpress/README.md',
          canva: 'docs/canva-to-wordpress/README.md',
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
          // Canva reuses the wizard's Canva path so there is one Canva code path.
          command: { exec: 'delegate', toScreen: 'wizard' },
          prerequisites: [{ kind: 'project' }],
        },
        {
          id: 'indesign' satisfies PipelineKind,
          label: 'InDesign',
          taskKind: 'pipeline:indesign',
          command: {
            exec: 'nodeBin',
            script: 'bin/flavian.mjs',
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
            { kind: 'service', service: 'wordpress', hint: 'QA needs a running, seeded WordPress site.' },
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
            { kind: 'service', service: 'wordpress', hint: 'QA needs a running, seeded WordPress site.' },
          ],
        },
      ],
    },
  ],
};
