import { spawn } from 'node:child_process';
import type {
  ProcessEvent,
  ProcessResult,
  ProcessRunner,
  RunHandle,
  RunSpec,
} from './runner-types';

/** How long to wait after SIGTERM before escalating to SIGKILL on cancel(). */
const KILL_GRACE_MS = 5000;

/**
 * Default ProcessRunner backed by node:child_process. Spawns with shell:false —
 * a `.sh` script is run as `bash <scriptPath>` (bash is the command, the path is
 * an arg), so no user-influenced string is ever parsed by a shell.
 */
export class ChildProcessRunner implements ProcessRunner {
  run(spec: RunSpec, onEvent: (event: ProcessEvent) => void): RunHandle {
    const child = spawn(spec.command, [...spec.args], {
      cwd: spec.cwd,
      env: spec.env ? { ...process.env, ...spec.env } : process.env,
      windowsHide: true,
      shell: false,
    });

    let settle!: (result: ProcessResult) => void;
    const done = new Promise<ProcessResult>((resolve) => {
      settle = resolve;
    });
    let settled = false;
    const finish = (result: ProcessResult): void => {
      if (!settled) {
        settled = true;
        settle(result);
      }
    };

    // Optional line-buffering: keep residual text per stream, emit completed lines,
    // flush the remainder on close.
    const residual: Record<'stdout' | 'stderr', string> = { stdout: '', stderr: '' };
    const onData = (stream: 'stdout' | 'stderr') => (data: Buffer | string): void => {
      const text = typeof data === 'string' ? data : data.toString('utf8');
      if (!spec.lineBuffered) {
        onEvent({ type: stream, chunk: text });
        return;
      }
      residual[stream] += text;
      let idx: number;
      while ((idx = residual[stream].indexOf('\n')) >= 0) {
        onEvent({ type: stream, chunk: residual[stream].slice(0, idx + 1) });
        residual[stream] = residual[stream].slice(idx + 1);
      }
    };
    const flush = (stream: 'stdout' | 'stderr'): void => {
      if (residual[stream]) {
        onEvent({ type: stream, chunk: residual[stream] });
        residual[stream] = '';
      }
    };

    child.stdout?.on('data', onData('stdout'));
    child.stderr?.on('data', onData('stderr'));

    child.on('spawn', () => {
      if (child.pid !== undefined) onEvent({ type: 'spawn', pid: child.pid });
    });

    child.on('error', (err: Error) => {
      // Fires on spawn failure (ENOENT etc.); 'close' will not fire in that case.
      onEvent({ type: 'error', message: err.message });
      finish({ code: null, signal: null });
    });

    child.on('close', (code, signal) => {
      flush('stdout');
      flush('stderr');
      onEvent({ type: 'exit', code, signal });
      finish({ code, signal });
    });

    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const cancel = (signal: NodeJS.Signals = 'SIGTERM'): void => {
      if (settled) return;
      child.kill(signal);
      killTimer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* already gone */
        }
      }, KILL_GRACE_MS);
      killTimer.unref?.();
    };
    void done.finally(() => {
      if (killTimer) clearTimeout(killTimer);
    });

    return {
      get pid(): number | undefined {
        return child.pid;
      },
      done,
      cancel,
    };
  }
}
