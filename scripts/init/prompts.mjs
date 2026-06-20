import { intro, outro, text, select, confirm, isCancel, cancel } from '@clack/prompts';
import { validateProjectName } from './validate-name.mjs';
import { slugify, titleCase } from './slugify.mjs';

function abortIfCancelled(value) {
  if (isCancel(value)) {
    cancel('Cancelled — no files written.');
    process.exit(130);
  }
  return value;
}

export async function runPrompts({ cwdBasename, gitEmail }) {
  intro('Flavian — interactive project setup');

  const projectName = abortIfCancelled(await text({
    message: 'Project / theme slug',
    placeholder: slugify(cwdBasename),
    defaultValue: slugify(cwdBasename),
    validate: v => validateProjectName(v) ?? undefined,
  }));

  const siteTitle = abortIfCancelled(await text({
    message: 'Site title (human-readable)',
    placeholder: titleCase(projectName),
    defaultValue: titleCase(projectName),
  }));

  const themeStarter = abortIfCancelled(await select({
    message: 'Theme starter',
    options: [
      { value: 'blank',        label: 'Blank FSE theme' },
      { value: 'flavian-shop', label: 'flavian-shop (WooCommerce-ready)' },
      { value: 'canva',        label: 'Canva export → FSE theme' },
      { value: 'figma',        label: 'Figma import placeholder' },
      { value: 'indesign',     label: 'InDesign import placeholder (not yet implemented)' },
    ],
  }));

  let canvaExport = null;
  if (themeStarter === 'canva') {
    canvaExport = abortIfCancelled(await text({
      message: 'Canva export directory (contains HTML + CSS)',
      placeholder: './canva-export',
      validate: v => (v && v.trim() !== '' ? undefined : 'An export directory is required'),
    }));
  }

  let woocommerce = themeStarter === 'flavian-shop';
  if (!woocommerce) {
    woocommerce = abortIfCancelled(await confirm({
      message: 'Enable WooCommerce support?',
      initialValue: false,
    }));
  }

  const multisite = abortIfCancelled(await confirm({
    message: 'Configure a WordPress multisite network?',
    initialValue: false,
  }));

  let multisiteMode = 'subdirectory';
  if (multisite) {
    multisiteMode = abortIfCancelled(await select({
      message: 'Multisite mode',
      options: [
        { value: 'subdirectory', label: 'Subdirectory (site.test/blog2) — works out of the box' },
        { value: 'subdomain',    label: 'Subdomain (blog2.site.test) — needs wildcard DNS locally' },
      ],
      initialValue: 'subdirectory',
    }));
  }

  const port = abortIfCancelled(await text({
    message: 'Local dev port',
    placeholder: '8080',
    defaultValue: '8080',
    validate: v => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1024 || n > 65535) return 'Port must be 1024–65535';
    },
  }));

  const adminEmail = abortIfCancelled(await text({
    message: 'Admin email',
    placeholder: gitEmail ?? 'admin@example.com',
    defaultValue: gitEmail ?? 'admin@example.com',
  }));

  const goAhead = abortIfCancelled(await confirm({ message: 'Proceed?', initialValue: true }));
  if (!goAhead) {
    cancel('Cancelled — no files written.');
    process.exit(130);
  }

  outro('Setting up your project…');

  return {
    projectName,
    siteTitle,
    themeStarter,
    canvaExport,
    woocommerce,
    multisite,
    multisiteMode,
    port: Number(port),
    adminEmail,
    initGit: true,
  };
}
