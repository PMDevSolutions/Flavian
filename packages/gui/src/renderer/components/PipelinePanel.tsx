import { useState } from 'react';
import type { PipelineInput, PipelineKind } from '../../shared/types/pipeline';
import { bridge } from '../api/bridge';
import { usePipeline } from '../hooks/usePipeline';
import { useTaskStream } from '../hooks/useTaskStream';
import { LogStream } from './LogStream';

const KINDS: { value: PipelineKind; label: string }[] = [
  { value: 'figma', label: 'Figma' },
  { value: 'canva', label: 'Canva' },
  { value: 'indesign', label: 'InDesign' },
];

const FIGMA_URL = /^https?:\/\/(www\.)?figma\.com\//i;

/** Per-pipeline reference docs (opened from the panel). */
const DOCS: Record<PipelineKind, string> = {
  figma: 'docs/figma-to-wordpress/README.md',
  canva: 'docs/canva-to-wordpress/README.md',
  indesign: 'docs/pipelines/indesign.md',
};

export function PipelinePanel() {
  const [kind, setKind] = useState<PipelineKind>('figma');
  const [slug, setSlug] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [canvaExport, setCanvaExport] = useState('');
  const [indesignFile, setIndesignFile] = useState('');

  const { result, error, running, lines, run, cancel, reset } = usePipeline();

  const figmaUrlValid = FIGMA_URL.test(figmaUrl.trim());
  const inputReady =
    kind === 'figma'
      ? figmaUrlValid
      : kind === 'canva'
        ? canvaExport.trim() !== ''
        : indesignFile.trim() !== '';
  const canLaunch = slug.trim() !== '' && inputReady && !running;

  const browseDir = (): void => {
    void bridge()
      .selectDirectory()
      .then((p) => {
        if (p) setCanvaExport(p);
      });
  };
  const browseFile = (): void => {
    void bridge()
      .selectFile(['idml', 'pdf'])
      .then((p) => {
        if (p) setIndesignFile(p);
      });
  };
  const openDoc = (): void => {
    void bridge().openPath(DOCS[kind]);
  };

  const [activateTaskId, setActivateTaskId] = useState<string | null>(null);
  const activate = useTaskStream(activateTaskId);
  const activateTheme = (themeSlug: string): void => {
    void bridge()
      .runDocker('activate-theme', themeSlug)
      .then(({ taskId }) => setActivateTaskId(taskId))
      .catch(() => {});
  };
  const openHelp = (relPath: string): void => {
    void bridge().openPath(relPath);
  };

  const launch = () => {
    const input: PipelineInput = { kind, slug: slug.trim(), figmaUrl, canvaExport, indesignFile };
    run(input);
  };

  if (running) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h1>Converting…</h1>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </header>
        <p className="panel-intro">
          Running the {kind} pipeline. {kind === 'figma' && 'This drives a headless Claude Code session.'}
        </p>
        <LogStream lines={lines} />
      </section>
    );
  }

  if (result) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h1>Convert design</h1>
          <button type="button" onClick={reset}>
            New conversion
          </button>
        </header>
        {result.ok ? (
          <>
            <div className="banner banner-ok">
              <strong>Conversion finished ({result.kind})</strong>
              <span className="summary">
                Theme: <code>themes/{result.slug}</code>
              </span>
            </div>
            <div className="form-actions">
              <button
                type="button"
                onClick={() => activateTheme(result.slug)}
                disabled={activate.state === 'running'}
              >
                {activate.state === 'running' ? 'Activating…' : 'Activate theme'}
              </button>
              {activate.state === 'succeeded' && (
                <span className="activate-note"> Activated — open it from the WordPress tab.</span>
              )}
              {activate.state === 'failed' && (
                <span className="field-error"> Activation failed — start WordPress first, then retry.</span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="banner banner-error">
              <strong>Conversion failed</strong>
              <span>{result.error}</span>
            </div>
            <p className="panel-intro">
              Troubleshooting:{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => openHelp('docs/COMMON-FAILURES-FIXES.md')}
              >
                Common failures &amp; fixes
              </button>
              {' · '}
              <button
                type="button"
                className="link-btn"
                onClick={() => openHelp('docs/TROUBLESHOOTING.md')}
              >
                Troubleshooting guide
              </button>
            </p>
          </>
        )}
        <details className="raw" open={!result.ok}>
          <summary>Conversion log</summary>
          <LogStream lines={lines} />
        </details>
      </section>
    );
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h1>Convert design</h1>
      </header>
      <p className="panel-intro">
        Turn a design into a WordPress FSE theme. Figma and Canva need no setup beyond their input;
        InDesign runs the deterministic <code>flavian pipeline indesign</code> CLI.
      </p>

      {error && <div className="banner banner-error">Could not start: {error}</div>}

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (canLaunch) launch();
        }}
      >
        <label className="field">
          <span>Pipeline</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as PipelineKind)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Theme slug</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-theme" spellCheck={false} />
        </label>

        {kind === 'figma' && (
          <label className="field">
            <span>Figma file URL (Dev Mode)</span>
            <input
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://www.figma.com/design/…"
              spellCheck={false}
            />
            {figmaUrl.trim() !== '' && !figmaUrlValid && (
              <span className="field-error">Enter a valid figma.com URL.</span>
            )}
          </label>
        )}

        {kind === 'canva' && (
          <div className="field">
            <span>Canva export directory</span>
            <div className="input-row">
              <input
                value={canvaExport}
                onChange={(e) => setCanvaExport(e.target.value)}
                placeholder="./canva-export"
                spellCheck={false}
              />
              <button type="button" onClick={browseDir}>
                Browse…
              </button>
            </div>
          </div>
        )}

        {kind === 'indesign' && (
          <div className="field">
            <span>InDesign file (.idml or .pdf)</span>
            <div className="input-row">
              <input
                value={indesignFile}
                onChange={(e) => setIndesignFile(e.target.value)}
                placeholder="./brochure.idml"
                spellCheck={false}
              />
              <button type="button" onClick={browseFile}>
                Browse…
              </button>
            </div>
          </div>
        )}

        {kind === 'figma' && (
          <p className="hint-note">
            Figma conversion needs <strong>Figma Dev Mode</strong> (a Figma Professional plan or
            higher) and opens a headless Claude Code session — Claude Code with Figma access must be
            configured.
          </p>
        )}

        <p className="panel-intro">
          <button type="button" className="link-btn" onClick={openDoc}>
            Learn more about the {KINDS.find((k) => k.value === kind)?.label} pipeline →
          </button>
        </p>

        <div className="form-actions">
          <button type="submit" disabled={!canLaunch}>
            Launch conversion
          </button>
        </div>
      </form>
    </section>
  );
}
