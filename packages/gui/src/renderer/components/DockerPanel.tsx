import { useCallback, useEffect, useState } from 'react';
import type { DockerCommand, DockerService } from '../../shared/types/docker';
import { bridge } from '../api/bridge';
import { useTaskStream } from '../hooks/useTaskStream';
import { LogStream } from './LogStream';

const LIFECYCLE: { command: DockerCommand; label: string }[] = [
  { command: 'build', label: 'Build' },
  { command: 'start', label: 'Start' },
  { command: 'stop', label: 'Stop' },
  { command: 'restart', label: 'Restart' },
  { command: 'install', label: 'Install WP' },
];

/** Turn a failed docker run's log into an actionable message (cf. docs/docker-troubleshooting.md). */
function dockerErrorHint(lines: string[]): string {
  const text = lines.join('\n').toLowerCase();
  if (/cannot connect to the docker daemon|docker daemon|daemon running/.test(text)) {
    return "Docker doesn't appear to be running. Start Docker Desktop, then retry.";
  }
  if (/port is already allocated|address already in use|bind for|already in use/.test(text)) {
    return 'A required port (8080 or 8081) is already in use. Stop the conflicting service or free the port, then retry.';
  }
  return 'The command failed — see the log above.';
}

export function DockerPanel() {
  const [status, setStatus] = useState<DockerService[] | null>(null);
  const [themes, setThemes] = useState<string[]>([]);
  const [selectedTheme, setSelectedTheme] = useState('');
  const [active, setActive] = useState<{ taskId: string; label: string; command: DockerCommand } | null>(
    null,
  );
  const stream = useTaskStream(active?.taskId ?? null);

  const refreshStatus = useCallback(() => {
    bridge()
      .getDockerStatus()
      .then(setStatus)
      .catch(() => setStatus([]));
  }, []);

  useEffect(() => {
    refreshStatus();
    bridge()
      .listThemes()
      .then((t) => {
        setThemes(t);
        setSelectedTheme((prev) => prev || t[0] || '');
      })
      .catch(() => setThemes([]));
  }, [refreshStatus]);

  const terminal =
    stream.state === 'succeeded' || stream.state === 'failed' || stream.state === 'cancelled';
  const busy = active !== null && !terminal;

  useEffect(() => {
    if (active && terminal) refreshStatus();
  }, [active, terminal, refreshStatus]);

  const run = (command: DockerCommand, label: string, arg?: string) => {
    bridge()
      .runDocker(command, arg)
      .then(({ taskId }) => setActive({ taskId, label, command }))
      .catch(() => setActive(null));
  };

  const cancel = () => {
    if (active) void bridge().cancelTask(active.taskId);
  };

  const anyRunning = (status ?? []).some((s) => s.state === 'running');
  const failed = active !== null && stream.state === 'failed';
  const openExternal = (url: string): void => {
    void bridge().openExternal(url);
  };

  return (
    <section className="panel">
      <header className="panel-header">
        <h1>WordPress (Docker)</h1>
        <button type="button" onClick={refreshStatus}>
          Refresh
        </button>
      </header>
      <p className="panel-intro">
        Drives the local Docker WordPress lifecycle via <code>wordpress-local.sh</code> and{' '}
        <code>docker compose</code>.
      </p>

      <div className="group">
        <h2>Containers</h2>
        {status === null ? (
          <p className="panel-intro">Loading…</p>
        ) : status.length === 0 ? (
          <p className="panel-intro">No containers — press Start.</p>
        ) : (
          <table className="status-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>State</th>
                <th>Status</th>
                <th>Ports</th>
              </tr>
            </thead>
            <tbody>
              {status.map((s) => (
                <tr key={s.name || s.service}>
                  <td>{s.service || s.name}</td>
                  <td>
                    <span className={`badge badge-${s.state === 'running' ? 'pass' : 'skip'}`}>
                      {s.state || '—'}
                    </span>
                  </td>
                  <td>{s.status}</td>
                  <td className="ports">{s.ports}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {anyRunning && (
        <div className="group">
          <h2>Open</h2>
          <div className="button-row">
            <button type="button" onClick={() => openExternal('http://localhost:8080')}>
              Site
            </button>
            <button type="button" onClick={() => openExternal('http://localhost:8080/wp-admin')}>
              wp-admin
            </button>
            <button type="button" onClick={() => openExternal('http://localhost:8081')}>
              Database (phpMyAdmin)
            </button>
          </div>
        </div>
      )}

      <div className="group">
        <h2>Lifecycle</h2>
        <p className="hint-note">
          First run: <strong>Build → Start → Install</strong> (creates the WordPress site) →{' '}
          <strong>Activate theme</strong>. After that, just Start / Stop.
        </p>
        <div className="button-row">
          {LIFECYCLE.map((l) => (
            <button key={l.command} type="button" disabled={busy} onClick={() => run(l.command, l.label)}>
              {l.label}
            </button>
          ))}
          <button type="button" disabled={busy} onClick={() => run('logs', 'Streaming logs')}>
            Stream logs
          </button>
        </div>
      </div>

      <div className="group">
        <h2>Activate theme</h2>
        <div className="button-row">
          <select value={selectedTheme} onChange={(e) => setSelectedTheme(e.target.value)} disabled={busy}>
            {themes.length === 0 && <option value="">No themes found</option>}
            {themes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !selectedTheme}
            onClick={() => run('activate-theme', `Activate ${selectedTheme}`, selectedTheme)}
          >
            Activate
          </button>
        </div>
      </div>

      {active && (
        <div className="group">
          <div className="panel-header">
            <h2>{active.label}</h2>
            {busy && (
              <button type="button" onClick={cancel}>
                {active.command === 'logs' ? 'Stop' : 'Cancel'}
              </button>
            )}
          </div>
          {failed && (
            <div className="banner banner-error">
              <strong>{active.label} failed</strong>
              <span>{dockerErrorHint(stream.lines)}</span>
              <button
                type="button"
                className="link-btn"
                onClick={() => void bridge().openPath('docs/docker-troubleshooting.md')}
              >
                Open the Docker troubleshooting guide
              </button>
            </div>
          )}
          <LogStream lines={stream.lines} />
        </div>
      )}
    </section>
  );
}
