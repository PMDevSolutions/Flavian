/**
 * Product manifest — the typed descriptor the GUI engine renders a product from.
 *
 * This is the seam that turns the shell from "the Flavian app" into a generic
 * engine: the engine (core + main + the renderer shell) reads *what to show and
 * what to run* from a ProductManifest, and the only product-specific knowledge
 * lives in the per-product manifest objects (./flavian, ./aurelius, ./vespasian). A
 * product is added by supplying another manifest — not by editing the engine; Nerva
 * and Claudius are next. See docs/GUI-PLATFORM.md and
 * docs/plans/2026-11-08-trajan-engine-reconciliation-design.md.
 *
 * It deliberately speaks the vocabulary the engine already uses — TaskKind,
 * DockerCommand, SiteCommand, QaScript, PipelineKind, ThemeStarter — rather than inventing a
 * parallel language. A manifest is PURE, SERIALIZABLE DATA (no functions, no
 * node imports) so it is safe to import from the sandboxed renderer as well as
 * from main/preload; behaviour (building a RunSpec, parsing output) is bound in
 * core via the typed keys below.
 */
import type { ThemeStarter } from '../types/init';
import type { TaskKind } from '../types/task';

/** Stable identifier for a product the engine can drive. */
export type ProductId =
  | 'flavian'
  | 'aurelius'
  | 'vespasian'
  | 'nerva'
  | 'claudius'
  | (string & {});

/**
 * The screens a product exposes in the shell. These mirror the renderer's views:
 * `docker` is Flavian's WordPress screen, `site` is Vespasian's Wix-site screen, the rest
 * are shared. `(string & {})` keeps literal autocomplete while letting a product add its own.
 */
export type ScreenId = 'prereq' | 'wizard' | 'docker' | 'site' | 'pipeline' | 'qa' | (string & {});

/**
 * How a step's command is executed. The generic engine (core/product/command-spec)
 * interprets a descriptor into a RunSpec via CommandBuilder — there is no
 * per-product code path. Script/module paths are PROJECT-ROOT-RELATIVE; the engine
 * resolves them against the active project root. `argsTemplate` entries may contain
 * `{name}` placeholders filled from the step's runtime variables (e.g. a theme
 * slug, a Figma URL); see buildCommandSpec.
 */
export type CommandDescriptor =
  | { readonly exec: 'bashScript'; readonly script: string; readonly argsTemplate?: readonly string[] }
  | { readonly exec: 'bashCommand'; readonly command: string }
  | { readonly exec: 'nodeBin'; readonly script: string; readonly argsTemplate?: readonly string[] }
  | { readonly exec: 'claude'; readonly argsTemplate: readonly string[] }
  /** Dynamic-import a repo module and run it in-process (the init wizard's apply()). */
  | { readonly exec: 'module'; readonly module: string }
  /** Reuse another screen's flow rather than spawning a command (Canva ⇒ the wizard). */
  | { readonly exec: 'delegate'; readonly toScreen: ScreenId };

/**
 * Key into the engine's output-parser registry (core/product/parsers). A step that
 * turns streamed text into a structured result names its parser here instead of the
 * engine hard-coding one. Deliberately a CLOSED union: the engine throws on an unknown
 * key at run time, so an open type would only hide typos. Adding a parser is one key
 * here plus one entry in core/product/parsers.ts; the registry test checks that every
 * parser a manifest names resolves.
 */
export type ParserKey = 'prereq' | 'composePs';

/**
 * A precondition the engine/shell can reason about. Only `project` is *enforced*
 * today (the shell disables a screen until a valid project is open); `tool` and
 * `service` reproduce the app's existing advisory guidance so the manifest captures
 * it without changing behaviour.
 */
export type Prerequisite =
  | { readonly kind: 'project' }
  | { readonly kind: 'tool'; readonly tool: string; readonly hint: string }
  | { readonly kind: 'service'; readonly service: string; readonly hint: string };

/**
 * One operation a screen can run. `id` reuses the screen's own vocabulary — a
 * DockerCommand for the WordPress screen, a SiteCommand for the Wix-site screen, a
 * QaScript for QA, a PipelineKind for conversions — so a step *is* the thing the engine
 * already knows how to dispatch.
 */
export interface ProductStep {
  /** Stable id; for docker/site/qa/pipeline screens this is the DockerCommand/SiteCommand/QaScript/PipelineKind. */
  readonly id: string;
  /** Canonical human label (headings, task names). */
  readonly label: string;
  /** Optional call-to-action text where a panel's button differs from `label`. */
  readonly cta?: string;
  /** The task kind this step produces — reuses the shared TaskKind vocabulary. */
  readonly taskKind: TaskKind;
  /** Optional grouping hint for panels that lay steps out in sections (e.g. docker). */
  readonly group?: string;
  /** How to build and run the command. */
  readonly command: CommandDescriptor;
  /** Which parser turns the command's output into a structured result (if any). */
  readonly parser?: ParserKey;
  /** Exit codes the engine treats as task-success. Default `[0]`; prereq allows `[0, 1]`. */
  readonly successExitCodes?: readonly number[];
  /** Preconditions for this step. */
  readonly prerequisites?: readonly Prerequisite[];
}

/**
 * Declarative, presentation-only extras a bespoke panel reads from the manifest.
 * These stay data (not behaviour) so the catalog lives in one place even though the
 * panel that renders them is product-specific.
 */
export interface ScreenExtras {
  /** Any screen: external links (the WordPress screen shows them once a container is up). */
  readonly links?: readonly { readonly label: string; readonly url: string }[];
  /** Wizard screen, module-backed products: the theme starters offered. */
  readonly themeStarters?: readonly { readonly value: ThemeStarter; readonly label: string }[];
  /** Wizard screen, script-backed products: the framework choices offered, in display order. */
  readonly frameworks?: readonly { readonly id: string; readonly label: string }[];
  /** Pipeline screen: per-kind reference docs (repo-relative). */
  readonly docs?: Readonly<Record<string, string>>;
}

/** A screen in the shell: a nav entry plus the steps it can run. */
export interface ProductScreen {
  readonly id: ScreenId;
  /** Label shown in the sidebar nav. */
  readonly navLabel: string;
  /** Heading shown at the top of the screen. */
  readonly title: string;
  readonly steps: readonly ProductStep[];
  /** Screen-level preconditions (every screen is project-gated today). */
  readonly prerequisites?: readonly Prerequisite[];
  readonly extras?: ScreenExtras;
}

/**
 * What makes a directory a valid checkout of this product, plus the copy the shell
 * shows when detection fails / a folder is being chosen. Owned by the manifest so
 * the engine's project detection (core/project/locate-root) stays generic.
 */
export interface ProjectIdentity {
  /** Files (project-root-relative) that must all be present. */
  readonly markers: readonly string[];
  /** Required `name` in the root package.json. */
  readonly packageName: string;
  /** Reason surfaced when a chosen folder is not a valid checkout. */
  readonly invalidReason: string;
  /** Reason surfaced when no checkout is found while walking up from a start dir. */
  readonly notFoundReason: string;
  /** Native folder-picker title. */
  readonly selectTitle: string;
  /** Native folder-picker message. */
  readonly selectMessage: string;
}

/** The single typed descriptor the engine renders any product from. */
export interface ProductManifest {
  readonly id: ProductId;
  /** Brand shown in the shell. */
  readonly displayName: string;
  readonly project: ProjectIdentity;
  readonly screens: readonly ProductScreen[];
}
