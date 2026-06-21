import { useEffect, useState } from 'react';
import type { ProjectRef } from '../shared/types/project';
import { bridge } from './api/bridge';
import { DockerPanel } from './components/DockerPanel';
import { PrereqPanel } from './components/PrereqPanel';
import { WizardPanel } from './components/WizardPanel';

type View = 'prereq' | 'wizard' | 'docker';

const VIEWS: { id: View; label: string }[] = [
  { id: 'prereq', label: 'Prerequisites' },
  { id: 'wizard', label: 'Setup wizard' },
  { id: 'docker', label: 'WordPress' },
];

const COMING_SOON = ['Convert design', 'Visual QA'];

export function App() {
  const [project, setProject] = useState<ProjectRef | null>(null);
  const [view, setView] = useState<View>('prereq');

  useEffect(() => {
    bridge()
      .getProject()
      .then(setProject)
      .catch(() => setProject(null));
  }, []);

  const projectName = project?.valid ? (project.root.split(/[\\/]/).pop() ?? project.root) : null;

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">Flavian</div>
        <ul className="nav">
          {VIEWS.map((v) => (
            <li
              key={v.id}
              className={`nav-item${view === v.id ? ' active' : ''}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </li>
          ))}
          {COMING_SOON.map((label) => (
            <li key={label} className="nav-item disabled" title="Coming soon">
              {label}
            </li>
          ))}
        </ul>
        <div className="project-info">
          {projectName ? (
            <span title={project?.root}>Project: {projectName}</span>
          ) : (
            <span className="warn">No Flavian project detected</span>
          )}
        </div>
      </nav>
      <main className="content">
        {view === 'prereq' && <PrereqPanel />}
        {view === 'wizard' && <WizardPanel />}
        {view === 'docker' && <DockerPanel />}
      </main>
    </div>
  );
}
