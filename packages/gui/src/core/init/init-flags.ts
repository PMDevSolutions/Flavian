import type { InitInput } from '../../shared/types/init';

/** The CLI "flags" shape consumed by scripts/init/default-resolver.mjs's resolveDefaults. */
export interface InitFlags {
  name: string;
  title?: string;
  theme: string;
  canva: boolean;
  canvaExport?: string;
  woo: boolean;
  multisite: boolean;
  multisiteMode: string;
  port: number;
  email?: string;
  noGit: boolean;
}

/**
 * Map the wizard's InitInput to the exact flag shape `pnpm run init --yes` passes
 * to resolveDefaults, so the GUI and CLI share one resolution + apply path.
 */
export function toInitFlags(input: InitInput): InitFlags {
  return {
    name: input.name,
    title: input.title.trim() || undefined,
    theme: input.theme,
    canva: input.theme === 'canva',
    canvaExport: input.canvaExport.trim() || undefined,
    woo: input.woo,
    multisite: input.multisite,
    multisiteMode: input.multisiteMode,
    port: input.port,
    email: input.email.trim() || undefined,
    noGit: !input.git,
  };
}
