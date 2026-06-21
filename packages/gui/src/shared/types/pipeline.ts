/** The three design-to-WordPress conversion pipelines the GUI can launch. */
export type PipelineKind = 'figma' | 'canva' | 'indesign';

export interface PipelineInput {
  kind: PipelineKind;
  /** Target theme slug (for Figma this is a hint passed to Claude). */
  slug: string;
  /** Figma file URL (kind === 'figma'). */
  figmaUrl?: string;
  /** Canva HTML/CSS export directory (kind === 'canva'). */
  canvaExport?: string;
  /** Path to an .idml or .pdf (kind === 'indesign'). */
  indesignFile?: string;
}

export interface PipelineResult {
  ok: boolean;
  kind: PipelineKind;
  slug: string;
  error?: string;
}
