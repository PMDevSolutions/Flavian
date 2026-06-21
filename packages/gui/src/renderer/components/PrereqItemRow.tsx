import type { PrereqItem } from '../../shared/types/prerequisites';
import { StatusBadge } from './StatusBadge';

export function PrereqItemRow({ item }: { item: PrereqItem }) {
  return (
    <li className={`prereq-row prereq-${item.status}`}>
      <StatusBadge status={item.status} />
      <div className="prereq-body">
        <div className="prereq-detail">{item.detail}</div>
        {item.version && (
          <div className="prereq-version">
            v{item.version}
            {item.minVersion ? ` (min ${item.minVersion})` : ''}
          </div>
        )}
        {item.status === 'fail' && item.guidance && (
          <div className="prereq-guidance">
            {item.guidance.text}
            {item.guidance.url && <span className="prereq-url"> — {item.guidance.url}</span>}
          </div>
        )}
      </div>
    </li>
  );
}
