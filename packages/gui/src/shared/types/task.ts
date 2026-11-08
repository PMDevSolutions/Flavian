/**
 * Task model — the uniform shape for every long-running, streamed operation the
 * GUI orchestrates (prereq check, docker or Wix-site lifecycle, conversions, visual QA).
 * Shared verbatim across core, main, preload and renderer.
 */
import type { DockerCommand } from './docker';
import type { PipelineKind } from './pipeline';
import type { SiteCommand } from './site';

export type TaskState = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

/**
 * Known task kinds: the vocabulary the product manifests emit (shared/product/*.ts). The
 * `(string & {})` member keeps literal autocompletion while still allowing a new product
 * to introduce kinds without editing this union.
 */
export type TaskKind =
  | 'prereq-check'
  | `prereq:${string}`
  | 'init'
  | `docker:${DockerCommand}`
  | `site:${SiteCommand}`
  | `pipeline:${PipelineKind}`
  | `qa:${string}`
  // (string & {}) preserves literal autocomplete while still allowing any string.
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
