/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  EXTENSION-POINT SCAFFOLD — NOT WIRED IN, NOT FUNCTIONAL (yet).                ║
 * ║                                                                                ║
 * ║  This file exists to show, concretely, how the "prove reuse with Aurelius"    ║
 * ║  stage (see docs/GUI-PLATFORM.md) lands: a second product is *only* another    ║
 * ║  ProductManifest — no engine, core, or renderer change. To activate it:        ║
 * ║    1. fill in the real screens/steps/commands below (delete the placeholders); ║
 * ║    2. register it in ./index.ts → PRODUCTS;                                     ║
 * ║    3. point ACTIVE_PRODUCT_ID at it (or select per-product at runtime under     ║
 * ║       the unified Trajan shell).                                                ║
 * ║                                                                                 ║
 * ║  It is deliberately NOT imported anywhere, so it ships in no bundle; it is      ║
 * ║  type-checked only, to keep the manifest contract honest.                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
import type { ProductManifest } from './manifest';

export const aureliusManifest: ProductManifest = {
  id: 'aurelius',
  displayName: 'Aurelius',

  // TODO(aurelius): replace with the real checkout markers + chooser copy.
  project: {
    markers: ['TODO-root-marker'],
    packageName: 'aurelius',
    invalidReason: 'TODO: not an Aurelius project.',
    notFoundReason: 'TODO: no Aurelius project found.',
    selectTitle: 'Select your Aurelius project folder',
    selectMessage: 'TODO: describe the Aurelius checkout to choose.',
  },

  // TODO(aurelius): declare Aurelius's real screens and steps. One placeholder screen
  // is shown so the shape is obvious; the engine renders whatever is listed here.
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
          successExitCodes: [0, 1],
          prerequisites: [{ kind: 'project' }],
        },
      ],
    },
  ],
};
