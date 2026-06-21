import { useCallback, useEffect, useState } from 'react';
import type { ProjectRef } from '../shared/types/project';
import { bridge } from './api/bridge';
import { DockerPanel } from './components/DockerPanel';
import { PipelinePanel } from './components/PipelinePanel';
import { PrereqPanel } from './components/PrereqPanel';
import { ProjectGate } from './components/ProjectGate';
import { QaPanel } from './components/QaPanel';
import { WizardPanel } from './components/WizardPanel';

type View = 'prereq' | 'wizard' | 'docker' | 'pipeline' | 'qa';

const VIEWS: { id: View; label: string }[] = [
  { id: 'prereq', label: 'Prerequisites' },
  { id: 'wizard', label: 'Setup wizard' },
  { id: 'docker', label: 'WordPress' },
  { id: 'pipeline', label: 'Convert design' },
  { id: 'qa', label: 'Visual QA' },
];

export function App() {
  const [project, setProject] = useState<ProjectRef | null>(null);
  const [view, setView] = useState<View>('prereq');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bridge()
      .getProject()
      .then(setProject)
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, []);

  const chooseProject = useCallback(() => {
    bridge()
      .selectProject()
      .then((ref) => setProject(ref))
      .catch(() => {});
  }, []);

  if (loading) {
    return <div className="app-loading">Loading…</div>;
  }

  const valid = project?.valid ?? false;
  const projectName =
    valid && project ? (project.root.split(/[\\/]/).pop() ?? project.root) : null;

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">Flavian</div>
        <ul className="nav">
          {VIEWS.map((v) => (
            <li
              key={v.id}
              className={`nav-item${view === v.id ? ' active' : ''}${valid ? '' : ' disabled'}`}
              onClick={() => valid && setView(v.id)}
            >
              {v.label}
            </li>
          ))}
        </ul>
        <div className="project-info">
          {valid && project ? (
            <>
              <span title={project.root}>Project: {projectName}</span>
              <button type="button" className="link-btn" onClick={chooseProject}>
                Change…
              </button>
            </>
          ) : (
            <button type="button" className="link-btn" onClick={chooseProject}>
              Choose project…
            </button>
          )}
        </div>
      </nav>
      <main className="content" key={project?.root ?? 'none'}>
        {!valid ? (
          <ProjectGate reason={project?.reason} onChoose={chooseProject} />
        ) : (
          <>
            {view === 'prereq' && <PrereqPanel />}
            {view === 'wizard' && <WizardPanel />}
            {view === 'docker' && <DockerPanel />}
            {view === 'pipeline' && <PipelinePanel />}
            {view === 'qa' && <QaPanel />}
          </>
        )}
      </main>
    </div>
  );
}
