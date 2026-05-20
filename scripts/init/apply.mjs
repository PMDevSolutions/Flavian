import { writeEnv } from './generators/env.mjs';
import { setupTheme } from './generators/theme.mjs';
import { setupWooCommerce } from './generators/woocommerce.mjs';
import { initGit } from './generators/git.mjs';
import { verify } from './verifier.mjs';

export async function apply(targetDir, config, logger = console.log) {
  const steps = [
    { name: '.env',         run: () => writeEnv(targetDir, config) },
    { name: 'theme',        run: () => setupTheme(targetDir, config) },
    { name: 'woocommerce',  run: () => setupWooCommerce(targetDir, config) },
    { name: 'git',          run: () => initGit(targetDir, config) },
  ];

  for (const step of steps) {
    await step.run();
    logger(`✓ ${step.name}`);
  }

  const result = await verify(targetDir, config);
  if (!result.ok) {
    for (const f of result.failures) logger(`✗ ${f.check}: ${f.reason}`);
    throw new Error('Verification failed');
  }
  logger('✓ verify');
}
