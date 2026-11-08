import type { PrereqGroup, PrereqItem, PrereqReport } from '../../shared/types/prerequisites';

/**
 * Copy for the Prerequisites banner. The script's own verdict ("Ready to use this
 * template: NO") was the first thing a new user read when a check failed (issue #191);
 * the banner now says what is wrong and which check to fix. Pure, so it is unit-tested.
 */
export interface ReadinessSummary {
  readonly tone: 'ok' | 'warn';
  readonly title: string;
  /** Second line under the title, or null when nothing needs fixing. */
  readonly detail: string | null;
}

/** Groups whose failures block readiness; optional software never does. */
const BLOCKING_GROUPS: ReadonlySet<PrereqGroup> = new Set<PrereqGroup>([
  'required-software',
  'required-accounts',
  'system-requirements',
]);

const blocking = (item: PrereqItem): boolean =>
  item.status === 'fail' && BLOCKING_GROUPS.has(item.group);

export function readinessSummary(
  report: Pick<PrereqReport, 'ready' | 'items'>,
  productName: string,
): ReadinessSummary {
  if (report.ready) {
    return {
      tone: 'ok',
      title: `All checks passed. This machine is ready for ${productName}.`,
      detail: null,
    };
  }
  const failing = report.items.filter(blocking).map((item) => item.label);
  if (failing.length === 0) {
    return {
      tone: 'warn',
      title: 'Not ready yet: the check did not complete',
      detail: 'See the raw output below, then re-check.',
    };
  }
  const count = failing.length === 1 ? '1 check needs' : `${failing.length} checks need`;
  return {
    tone: 'warn',
    title: `Not ready yet: ${count} attention`,
    detail: `${failing.join(', ')}. Follow the guidance below, then re-check.`,
  };
}
