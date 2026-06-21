/**
 * Setup-wizard model. The GUI collects an InitInput, which main maps to the CLI
 * "flags" shape and feeds to the existing resolveDefaults()/apply() in scripts/init/
 * — sharing one code path with `pnpm run init` rather than reimplementing it.
 */

export type ThemeStarter = 'blank' | 'flavian-shop' | 'canva' | 'figma' | 'indesign';
export type MultisiteMode = 'subdirectory' | 'subdomain';

export interface InitInput {
  /** Project / theme slug. */
  name: string;
  /** Human-readable site title; empty → derived from the slug. */
  title: string;
  theme: ThemeStarter;
  /** Canva HTML/CSS export directory; required when theme === 'canva'. */
  canvaExport: string;
  woo: boolean;
  multisite: boolean;
  multisiteMode: MultisiteMode;
  port: number;
  email: string;
  /** Initialize a git repo (maps to the inverse of --no-git). */
  git: boolean;
}

export interface InitResult {
  ok: boolean;
  projectName: string;
  themeStarter: ThemeStarter;
  port: number;
  error?: string;
}
