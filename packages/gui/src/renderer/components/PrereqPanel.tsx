import { useEffect } from 'react';
import { activeManifest } from '../../shared/product';
import type { PrereqGroup, PrereqReport } from '../../shared/types/prerequisites';
import { usePrerequisites } from '../hooks/usePrerequisites';
import { LogStream } from './LogStream';
import { PrereqItemRow } from './PrereqItemRow';

const GROUP_TITLES: Record<PrereqGroup, string> = {
  'required-software': 'Required software',
  'required-accounts': 'Required accounts',
  'optional-software': 'Optional software',
  'system-requirements': 'System requirements',
  unknown: 'Other',
};

const GROUP_ORDER: PrereqGroup[] = [
  'required-software',
  'required-accounts',
  'optional-software',
  'system-requirements',
  'unknown',
];

function ReadyBanner({ report }: { report: PrereqReport }) {
  const s = report.summary;
  return (
    <div className={`banner ${report.ready ? 'banner-ok' : 'banner-warn'}`}>
      <strong>Ready to use this template: {report.ready ? 'YES' : 'NO'}</strong>
      <span className="summary">
        Required {s.requiredPassed}/{s.requiredTotal} · Optional {s.optionalInstalled}/
        {s.optionalTotal} · System {s.systemPassed}/{s.systemTotal}
      </span>
    </div>
  );
}

export function PrereqPanel() {
  const { report, error, running, lines, run } = usePrerequisites();

  useEffect(() => {
    run();
  }, [run]);

  return (
    <section className="panel">
      <header className="panel-header">
        <h1>Prerequisites</h1>
        <button type="button" onClick={run} disabled={running}>
          {running ? 'Checking…' : 'Re-check'}
        </button>
      </header>

      <p className="panel-intro">
        Verifies the tools {activeManifest.displayName} needs (Claude Code, Docker, Git, Node) by
        running the repo&rsquo;s <code>check-prerequisites.sh</code> and showing the result here.
      </p>

      {error && <div className="banner banner-error">Could not run the check: {error}</div>}

      {report && <ReadyBanner report={report} />}

      {running && !report && <LogStream lines={lines} />}

      {report &&
        GROUP_ORDER.map((group) => {
          const items = report.items.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="group">
              <h2>{GROUP_TITLES[group]}</h2>
              <ul className="prereq-list">
                {items.map((item, idx) => (
                  <PrereqItemRow key={`${group}-${idx}`} item={item} />
                ))}
              </ul>
            </div>
          );
        })}

      {report && (
        <details className="raw">
          <summary>Raw output</summary>
          <pre className="log-stream">{report.raw}</pre>
        </details>
      )}
    </section>
  );
}
