/**
 * Structured model of a `scripts/check-prerequisites.sh` run. The bash script
 * prints `[PASS]/[FAIL]/[SKIP]/[INFO]` lines under section headers plus a summary;
 * prereq-parser.ts turns that text into this model, and the renderer renders it.
 */

export type PrereqStatus = 'pass' | 'fail' | 'skip' | 'info';

export type PrereqGroup =
  | 'required-software'
  | 'required-accounts'
  | 'optional-software'
  | 'system-requirements'
  | 'unknown';

/** Curated remediation guidance for a failing prerequisite. */
export interface PrereqGuidance {
  text: string;
  url?: string;
}

export interface PrereqItem {
  group: PrereqGroup;
  status: PrereqStatus;
  /** Canonical tool key when recognized: git|docker|claude|gh|wp|node|php|composer|ram|disk|os. */
  key?: string;
  /** Human label, e.g. "Git", "Docker". */
  label: string;
  /** Full message text after the status tag. */
  detail: string;
  /** Parsed installed version, e.g. "2.43.0". */
  version?: string;
  /** Parsed minimum, e.g. "2.30.0" from "(minimum: 2.30.0)". */
  minVersion?: string;
  /** Curated guidance (from prereq-metadata) — populated for failures. */
  guidance?: PrereqGuidance;
  /** Indented continuation lines emitted by the script under this item. */
  hints: string[];
}

export interface PrereqSummary {
  requiredPassed: number;
  requiredTotal: number;
  optionalInstalled: number;
  optionalTotal: number;
  systemPassed: number;
  systemTotal: number;
}

export interface PrereqReport {
  items: PrereqItem[];
  summary: PrereqSummary;
  /** Derived from the script's exit-code contract (0 = ready), cross-checked against fails. */
  ready: boolean;
  exitCode: number | null;
  /** Full captured (ANSI-stripped) output, for a "show raw" toggle. */
  raw: string;
}
