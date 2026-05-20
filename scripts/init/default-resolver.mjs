import { slugify, titleCase } from './slugify.mjs';

const VALID_THEMES = ['blank', 'flavian-shop', 'figma', 'indesign'];

export function resolveDefaults(flags, env) {
  const projectName = flags.name
    ? slugify(flags.name)
    : slugify(env.cwdBasename || 'flavian-site');

  const themeStarter = flags.theme ?? 'blank';
  if (!VALID_THEMES.includes(themeStarter)) {
    throw new Error(`Unknown theme starter: ${themeStarter} (expected one of ${VALID_THEMES.join(', ')})`);
  }

  const woocommerce = themeStarter === 'flavian-shop' ? true : Boolean(flags.woo);

  return {
    projectName,
    siteTitle: flags.title ?? titleCase(projectName),
    themeStarter,
    woocommerce,
    port: Number.isInteger(flags.port) ? flags.port : 8080,
    adminEmail: flags.email ?? env.gitEmail ?? 'admin@example.com',
    initGit: !flags.noGit,
  };
}
