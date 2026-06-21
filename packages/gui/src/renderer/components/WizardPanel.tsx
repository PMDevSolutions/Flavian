import { useEffect, useState, type FormEvent } from 'react';
import type { InitInput, MultisiteMode, ThemeStarter } from '../../shared/types/init';
import { bridge } from '../api/bridge';
import { useInit } from '../hooks/useInit';
import { LogStream } from './LogStream';

const THEMES: { value: ThemeStarter; label: string }[] = [
  { value: 'blank', label: 'Blank FSE theme' },
  { value: 'flavian-shop', label: 'flavian-shop (WooCommerce-ready)' },
  { value: 'canva', label: 'Canva export → FSE theme' },
  { value: 'figma', label: 'Figma import placeholder' },
  { value: 'indesign', label: 'InDesign import placeholder' },
];

const DEFAULT_INPUT: InitInput = {
  name: '',
  title: '',
  theme: 'blank',
  canvaExport: '',
  woo: false,
  multisite: false,
  multisiteMode: 'subdirectory',
  port: 8080,
  email: '',
  git: true,
};

export function WizardPanel() {
  const [input, setInput] = useState<InitInput>(DEFAULT_INPUT);
  const { result, error, running, lines, run, reset } = useInit();

  useEffect(() => {
    bridge()
      .getProject()
      .then((p) => {
        if (!p.valid) return;
        const base = p.root.split(/[\\/]/).pop() ?? '';
        setInput((prev) => (prev.name ? prev : { ...prev, name: base }));
      })
      .catch(() => {});
  }, []);

  function update<K extends keyof InitInput>(key: K, value: InitInput[K]): void {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  const wooForced = input.theme === 'flavian-shop';
  const canSubmit =
    input.name.trim() !== '' &&
    (input.theme !== 'canva' || input.canvaExport.trim() !== '') &&
    !running;

  function submit(e: FormEvent): void {
    e.preventDefault();
    run({ ...input, woo: wooForced ? true : input.woo });
  }

  if (result) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h1>Setup wizard</h1>
          <button type="button" onClick={reset}>
            Start over
          </button>
        </header>
        {result.ok ? (
          <>
            <div className="banner banner-ok">
              <strong>Project ready: {result.projectName}</strong>
              <span className="summary">
                Theme starter: {result.themeStarter} · Port {result.port}
              </span>
            </div>
            <div className="next-steps">
              <h2>Next steps</h2>
              <ol>
                <li>
                  Start WordPress (the <strong>WordPress</strong> tab, coming soon) or run{' '}
                  <code>./wordpress-local.sh start</code>.
                </li>
                <li>
                  Open <code>http://localhost:{result.port}</code>.
                </li>
                <li>
                  Activate the theme <code>{result.projectName}</code>.
                </li>
              </ol>
            </div>
          </>
        ) : (
          <div className="banner banner-error">
            <strong>Setup failed</strong>
            <span>{result.error}</span>
          </div>
        )}
        <details className="raw" open={!result.ok}>
          <summary>Setup log</summary>
          <LogStream lines={lines} />
        </details>
      </section>
    );
  }

  if (running) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h1>Setting up…</h1>
        </header>
        <p className="panel-intro">
          Running project setup — the same code path as <code>pnpm run init</code>.
        </p>
        <LogStream lines={lines} />
      </section>
    );
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h1>Setup wizard</h1>
      </header>
      <p className="panel-intro">
        Scaffold a project the same way <code>pnpm run init</code> does — this calls the
        wizard&rsquo;s <code>apply()</code> directly, so the GUI and CLI stay in lockstep.
      </p>

      {error && <div className="banner banner-error">Could not start setup: {error}</div>}

      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Project slug</span>
          <input
            value={input.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="my-site"
            spellCheck={false}
          />
        </label>

        <label className="field">
          <span>
            Site title <em>(optional)</em>
          </span>
          <input
            value={input.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="My Site"
          />
        </label>

        <label className="field">
          <span>Theme starter</span>
          <select value={input.theme} onChange={(e) => update('theme', e.target.value as ThemeStarter)}>
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {input.theme === 'canva' && (
          <label className="field">
            <span>Canva export directory</span>
            <input
              value={input.canvaExport}
              onChange={(e) => update('canvaExport', e.target.value)}
              placeholder="./canva-export"
              spellCheck={false}
            />
          </label>
        )}

        <label className="field-check">
          <input
            type="checkbox"
            checked={wooForced ? true : input.woo}
            disabled={wooForced}
            onChange={(e) => update('woo', e.target.checked)}
          />
          <span>Enable WooCommerce{wooForced ? ' (required by flavian-shop)' : ''}</span>
        </label>

        <label className="field-check">
          <input
            type="checkbox"
            checked={input.multisite}
            onChange={(e) => update('multisite', e.target.checked)}
          />
          <span>Configure a multisite network</span>
        </label>

        {input.multisite && (
          <label className="field">
            <span>Multisite mode</span>
            <select
              value={input.multisiteMode}
              onChange={(e) => update('multisiteMode', e.target.value as MultisiteMode)}
            >
              <option value="subdirectory">Subdirectory (works out of the box)</option>
              <option value="subdomain">Subdomain (needs wildcard DNS)</option>
            </select>
          </label>
        )}

        <label className="field">
          <span>Local dev port</span>
          <input
            type="number"
            min={1024}
            max={65535}
            value={input.port}
            onChange={(e) => update('port', Number(e.target.value))}
          />
        </label>

        <label className="field">
          <span>
            Admin email <em>(optional)</em>
          </span>
          <input
            type="email"
            value={input.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="admin@example.com"
          />
        </label>

        <label className="field-check">
          <input type="checkbox" checked={input.git} onChange={(e) => update('git', e.target.checked)} />
          <span>Initialize a git repository</span>
        </label>

        <div className="form-actions">
          <button type="submit" disabled={!canSubmit}>
            Run setup
          </button>
        </div>
      </form>
    </section>
  );
}
