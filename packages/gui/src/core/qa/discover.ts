import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type {
  LighthouseSummary,
  QaArtifacts,
  VisualReport,
  VisualResult,
} from '../../shared/types/qa';

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

interface RawVisualReport {
  totalFiles?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
  overallPass?: boolean;
  results?: Array<{ file: string; status?: string; mismatchPct?: number; pass?: boolean }>;
}

/** Map tests/visual/report.json, reconstructing image paths from the diff naming convention. */
export function mapVisualReport(raw: RawVisualReport): VisualReport {
  const results: VisualResult[] = (raw.results ?? []).map((r) => ({
    file: r.file,
    status: (r.status as VisualResult['status']) ?? 'MISSING',
    mismatchPct: r.mismatchPct,
    pass: r.pass,
    actualRel: `tests/visual/actual/${r.file}`,
    baselineRel: `tests/visual/baselines/${r.file}`,
    diffRel: `tests/visual/diffs/diff-${r.file}`,
  }));
  return {
    totalFiles: raw.totalFiles ?? results.length,
    passed: raw.passed ?? 0,
    failed: raw.failed ?? 0,
    skipped: raw.skipped ?? 0,
    overallPass: raw.overallPass ?? false,
    results,
  };
}

interface RawAssertion {
  url?: string;
  auditId?: string;
  passed?: boolean;
  expected?: number | string;
  actual?: number | string;
}

/** Summarize .lighthouseci/assertion-results.json (capping failures for display). */
export function mapLighthouse(raw: RawAssertion[]): LighthouseSummary {
  const failures = raw
    .filter((a) => a.passed === false)
    .map((a) => ({
      url: a.url ?? '',
      auditId: a.auditId ?? '',
      expected: String(a.expected ?? ''),
      actual: String(a.actual ?? ''),
    }));
  return {
    total: raw.length,
    passed: raw.filter((a) => a.passed === true).length,
    failed: failures.length,
    failures: failures.slice(0, 50),
  };
}

/** Discover whatever QA artifacts exist on disk for the project. */
export async function discoverQaArtifacts(repoRoot: string): Promise<QaArtifacts> {
  const rawVisual = await readJson<RawVisualReport>(
    join(repoRoot, 'tests', 'visual', 'report.json'),
  );
  const rawLh = await readJson<RawAssertion[]>(
    join(repoRoot, '.lighthouseci', 'assertion-results.json'),
  );
  const qaReport = '.claude/visual-qa/report.md';
  const qaReportPath = (await exists(join(repoRoot, '.claude', 'visual-qa', 'report.md')))
    ? qaReport
    : null;

  return {
    visual: rawVisual ? mapVisualReport(rawVisual) : null,
    lighthouse: Array.isArray(rawLh) ? mapLighthouse(rawLh) : null,
    qaReportPath,
  };
}
