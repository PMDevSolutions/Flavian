import { slugify, titleCase } from './slugify.mjs';

const VALID_THEMES = ['blank', 'flavian-shop', 'figma', 'indesign'];
const VALID_MULTISITE_MODES = ['subdirectory', 'subdomain'];

export function resolveDefaults(flags, env) {
  const projectName = flags.name
    ? slugify(flags.name)
    : slugify(env.cwdBasename || 'flavian-site');

  const themeStarter = flags.theme ?? 'blank';
  if (!VALID_THEMES.includes(themeStarter)) {
    throw new Error(`Unknown theme starter: ${themeStarter} (expected one of ${VALID_THEMES.join(', ')})`);
  }

  const woocommerce = themeStarter === 'flavian-shop' ? true : Boolean(flags.woo);

  const multisite = Boolean(flags.multisite);
  const multisiteMode = flags.multisiteMode ?? 'subdirectory';
  if (!VALID_MULTISITE_MODES.includes(multisiteMode)) {
    throw new Error(`Unknown multisite mode: ${multisiteMode} (expected one of ${VALID_MULTISITE_MODES.join(', ')})`);
  }

  return {
    projectName,
    siteTitle: flags.title ?? titleCase(projectName),
    themeStarter,
    woocommerce,
    multisite,
    multisiteMode,
    port: Number.isInteger(flags.port) ? flags.port : 8080,
    adminEmail: flags.email ?? env.gitEmail ?? 'admin@example.com',
    initGit: !flags.noGit,
  };
}
