/** Visual-QA artifacts the GUI discovers and renders. */

export type QaScript = 'visual:diff' | 'lighthouse:run';

export interface VisualResult {
  file: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'MISSING';
  mismatchPct?: number;
  pass?: boolean;
  /** Repo-relative image paths (reconstructed from the visual-diff naming convention). */
  actualRel: string;
  baselineRel: string;
  diffRel: string;
}

export interface VisualReport {
  totalFiles: number;
  passed: number;
  failed: number;
  skipped: number;
  overallPass: boolean;
  results: VisualResult[];
}

export interface LighthouseFailure {
  url: string;
  auditId: string;
  expected: string;
  actual: string;
}

export interface LighthouseSummary {
  total: number;
  passed: number;
  failed: number;
  failures: LighthouseFailure[];
}

export interface QaArtifacts {
  /** Parsed tests/visual/report.json (pixel-diff results), or null if absent. */
  visual: VisualReport | null;
  /** Parsed .lighthouseci/assertion-results.json summary, or null if absent. */
  lighthouse: LighthouseSummary | null;
  /** Repo-relative path to .claude/visual-qa/report.md if present. */
  qaReportPath: string | null;
}
