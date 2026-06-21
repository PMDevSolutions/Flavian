import type { PrereqStatus } from '../../shared/types/prerequisites';

const LABEL: Record<PrereqStatus, string> = {
  pass: 'PASS',
  fail: 'FAIL',
  skip: 'SKIP',
  info: 'INFO',
};

export function StatusBadge({ status }: { status: PrereqStatus }) {
  return <span className={`badge badge-${status}`}>{LABEL[status]}</span>;
}
