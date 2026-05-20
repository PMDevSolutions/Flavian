import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export async function initGit(targetDir, config) {
  if (!config.initGit) return;

  await rm(join(targetDir, '.git'), { recursive: true, force: true });
  await exec('git', ['init', '-b', 'main'], { cwd: targetDir });
  await exec('git', ['add', '-A'], { cwd: targetDir });
  await exec(
    'git',
    ['commit', '-m', 'chore: initial Flavian scaffold', '--no-verify'],
    {
      cwd: targetDir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'Flavian Init',
        GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'init@flavian.local',
        GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || 'Flavian Init',
        GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || 'init@flavian.local',
      },
    }
  );
}
