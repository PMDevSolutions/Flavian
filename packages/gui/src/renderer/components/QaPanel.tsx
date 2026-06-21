import { useCallback, useEffect, useState } from 'react';
import type { QaArtifacts, QaScript, VisualResult } from '../../shared/types/qa';
import { bridge } from '../api/bridge';
import { useTaskStream } from '../hooks/useTaskStream';
import { ArtifactImage } from './ArtifactImage';
import { LogStream } from './LogStream';

function VisualDiffRow({ result }: { result: VisualResult }) {
  return (
    <div className="diff-row">
      <div className="diff-head">
        <span className="badge badge-fail">FAIL</span>
        <span>{result.file}</span>
        {result.mismatchPct !== undefined && (
          <span className="prereq-version">{(result.mismatchPct * 100).toFixed(2)}% diff</span>
        )}
      </div>
      <div className="diff-images">
        <figure>
          <figcaption>Baseline</figcaption>
          <ArtifactImage relPath={result.baselineRel} alt={`baseline ${result.file}`} />
        </figure>
        <figure>
          <figcaption>Actual</figcaption>
          <ArtifactImage relPath={result.actualRel} alt={`actual ${result.file}`} />
        </figure>
        <figure>
          <figcaption>Diff</figcaption>
          <ArtifactImage relPath={result.diffRel} alt={`diff ${result.file}`} />
        </figure>
      </div>
    </div>
  );
}

function QaReport({ path }: { path: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    bridge()
      .readQaText(path)
      .then(setText)
      .catch(() => setText(null));
  }, [path]);
  if (!text) return null;
  return (
    <div className="group">
      <h2>QA agent report</h2>
      <pre className="log-stream">{text}</pre>
    </div>
  );
}

export function QaPanel() {
  const [artifacts, setArtifacts] = useState<QaArtifacts | null>(null);
  const [active, setActive] = useState<{ taskId: string; label: string } | null>(null);
  const stream = useTaskStream(active?.taskId ?? null);

  const refresh = useCallback(() => {
    bridge()
      .getQaArtifacts()
      .then(setArtifacts)
      .catch(() => setArtifacts(null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const terminal =
    stream.state === 'succeeded' || stream.state === 'failed' || stream.state === 'cancelled';
  const busy = active !== null && !terminal;

  useEffect(() => {
    if (active && terminal) refresh();
  }, [active, terminal, refresh]);

  const runQa = (script: QaScript, label: string) => {
    bridge()
      .runQa(script)
      .then(({ taskId }) => setActive({ taskId, label }))
      .catch(() => setActive(null));
  };

  const visual = artifacts?.visual ?? null;
  const lighthouse = artifacts?.lighthouse ?? null;
  const failures = visual?.results.filter((r) => r.status === 'FAIL') ?? [];

  return (
    <section className="panel">
      <header className="panel-header">
        <h1>Visual QA</h1>
        <button type="button" onClick={refresh}>
          Refresh
        </button>
      </header>
      <p className="panel-intro">
        Run visual regression and Lighthouse, then review the artifacts. These need a running,
        seeded WordPress site (start it from the WordPress tab).
      </p>

      <div className="button-row">
        <button type="button" disabled={busy} onClick={() => runQa('visual:diff', 'Visual diff')}>
          Run visual diff
        </button>
        <button type="button" disabled={busy} onClick={() => runQa('lighthouse:run', 'Lighthouse')}>
          Run Lighthouse
        </button>
      </div>

      {active && (
        <div className="group">
          <h2>
            {active.label}
            {busy ? ' — running…' : ''}
          </h2>
          <LogStream lines={stream.lines} />
        </div>
      )}

      <div className="group">
        <h2>Visual regression</h2>
        {!visual ? (
          <p className="panel-intro">No tests/visual/report.json yet — run the visual diff.</p>
        ) : (
          <>
            <div className={`banner ${visual.overallPass ? 'banner-ok' : 'banner-warn'}`}>
              <strong>{visual.overallPass ? 'All screenshots match' : 'Visual differences found'}</strong>
              <span className="summary">
                {visual.passed} passed · {visual.failed} failed · {visual.skipped} skipped of{' '}
                {visual.totalFiles}
              </span>
            </div>
            {failures.map((r) => (
              <VisualDiffRow key={r.file} result={r} />
            ))}
          </>
        )}
      </div>

      <div className="group">
        <h2>Lighthouse</h2>
        {!lighthouse ? (
          <p className="panel-intro">No .lighthouseci results yet — run Lighthouse.</p>
        ) : (
          <>
            <div className={`banner ${lighthouse.failed === 0 ? 'banner-ok' : 'banner-warn'}`}>
              <strong>
                {lighthouse.failed === 0
                  ? 'All assertions passed'
                  : `${lighthouse.failed} assertion(s) failed`}
              </strong>
              <span className="summary">
                {lighthouse.passed}/{lighthouse.total} passed
              </span>
            </div>
            {lighthouse.failures.length > 0 && (
              <table className="status-table">
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Audit</th>
                    <th>Expected</th>
                    <th>Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {lighthouse.failures.map((f, i) => (
                    <tr key={`${f.url}-${f.auditId}-${i}`}>
                      <td>{f.url}</td>
                      <td>{f.auditId}</td>
                      <td>{f.expected}</td>
                      <td>{f.actual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {artifacts?.qaReportPath && <QaReport path={artifacts.qaReportPath} />}
    </section>
  );
}
