import { useEffect, useState } from 'react';
import type { ProjectRef } from '../shared/types/project';
import { bridge } from './api/bridge';
import { PrereqPanel } from './components/PrereqPanel';

const COMING_SOON = ['Setup wizard', 'WordPress', 'Convert design', 'Visual QA'];

export function App() {
  const [project, setProject] = useState<ProjectRef | null>(null);

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
          <li className="nav-item active">Prerequisites</li>
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
        <PrereqPanel />
      </main>
    </div>
  );
}
