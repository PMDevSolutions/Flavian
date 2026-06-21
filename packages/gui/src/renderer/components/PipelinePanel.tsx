import { useState } from 'react';
import type { PipelineInput, PipelineKind } from '../../shared/types/pipeline';
import { usePipeline } from '../hooks/usePipeline';
import { LogStream } from './LogStream';

const KINDS: { value: PipelineKind; label: string }[] = [
  { value: 'figma', label: 'Figma' },
  { value: 'canva', label: 'Canva' },
  { value: 'indesign', label: 'InDesign' },
];

export function PipelinePanel() {
  const [kind, setKind] = useState<PipelineKind>('figma');
  const [slug, setSlug] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [canvaExport, setCanvaExport] = useState('');
  const [indesignFile, setIndesignFile] = useState('');

  const { result, error, running, lines, run, cancel, reset } = usePipeline();

  const inputReady =
    kind === 'figma'
      ? figmaUrl.trim() !== ''
      : kind === 'canva'
        ? canvaExport.trim() !== ''
        : indesignFile.trim() !== '';
  const canLaunch = slug.trim() !== '' && inputReady && !running;

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
          <div className="banner banner-ok">
            <strong>Conversion finished ({result.kind})</strong>
            <span className="summary">
              Theme: <code>themes/{result.slug}</code> — activate it from the WordPress tab.
            </span>
          </div>
        ) : (
          <div className="banner banner-error">
            <strong>Conversion failed</strong>
            <span>{result.error}</span>
          </div>
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
            <span>Figma file URL</span>
            <input
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://www.figma.com/design/…"
              spellCheck={false}
            />
          </label>
        )}

        {kind === 'canva' && (
          <label className="field">
            <span>Canva export directory</span>
            <input
              value={canvaExport}
              onChange={(e) => setCanvaExport(e.target.value)}
              placeholder="./canva-export"
              spellCheck={false}
            />
          </label>
        )}

        {kind === 'indesign' && (
          <label className="field">
            <span>InDesign file (.idml or .pdf)</span>
            <input
              value={indesignFile}
              onChange={(e) => setIndesignFile(e.target.value)}
              placeholder="./brochure.idml"
              spellCheck={false}
            />
          </label>
        )}

        {kind === 'figma' && (
          <p className="hint-note">
            Figma conversion opens a headless Claude Code session and requires Claude Code with Figma
            access configured.
          </p>
        )}

        <div className="form-actions">
          <button type="submit" disabled={!canLaunch}>
            Launch conversion
          </button>
        </div>
      </form>
    </section>
  );
}
