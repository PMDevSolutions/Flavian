/**
 * Task model — the uniform shape for every long-running, streamed operation the
 * GUI orchestrates (prereq check, docker lifecycle, conversions, visual QA).
 * Shared verbatim across core, main, preload and renderer.
 */

export type TaskState = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

/**
 * Known task kinds. The `(string & {})` member keeps literal autocompletion while
 * still allowing sub-issues 2–6 to introduce new kinds without editing this union.
 */
export type TaskKind =
  | 'prereq-check'
  | 'docker-start'
  | 'docker-stop'
  | 'pipeline-indesign'
  | 'pipeline-canva'
  | 'pipeline-figma'
  | 'visual-qa'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

/** An incremental event emitted while a task runs. */
export type TaskEvent =
  | { kind: 'log'; stream: 'stdout' | 'stderr'; line: string }
  | { kind: 'state'; state: TaskState; exitCode?: number | null };

/** A point-in-time view of a task, including a bounded tail of its log. */
export interface TaskSnapshot {
  id: string;
  kind: TaskKind;
  state: TaskState;
  exitCode: number | null;
  startedAt: number | null;
  endedAt: number | null;
  logTail: string[];
}
