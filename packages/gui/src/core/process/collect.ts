import type { ProcessRunner, RunSpec } from './runner-types';

export interface CollectedOutput {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Run a command to completion, accumulating its output — for quick, non-streamed queries. */
export function collectOutput(runner: ProcessRunner, spec: RunSpec): Promise<CollectedOutput> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const handle = runner.run(spec, (event) => {
      if (event.type === 'stdout') stdout += event.chunk;
      else if (event.type === 'stderr') stderr += event.chunk;
    });
    void handle.done.then((res) => resolve({ code: res.code, stdout, stderr }));
  });
}
