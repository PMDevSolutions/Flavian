import type { InitInput, InitResult } from './init';
import type { PrereqReport } from './prerequisites';
import type { ProjectRef } from './project';
import type { TaskEvent, TaskSnapshot } from './task';

/** Payload carried on the main → renderer push channel for task output. */
export interface TaskEventEnvelope {
  taskId: string;
  event: TaskEvent;
}

/**
 * The typed surface exposed to the renderer as `window.flavian` (via contextBridge).
 * This is the ONLY way the renderer talks to main — it can invoke these named,
 * typed operations and nothing else (no arbitrary command execution).
 *
 * Extension model for sub-issues 2–6: add one typed method here + a matching
 * ipcMain.handle, and (optionally) a new TaskKind. The generic task methods
 * (onTaskEvent / getTaskSnapshot / cancelTask) already work for any task.
 */
export interface FlavianBridge {
  /** The current project root + validity. */
  getProject(): Promise<ProjectRef>;

  /** Start a prerequisite check; returns the task id to subscribe to. */
  runPrereqCheck(): Promise<{ taskId: string }>;

  /** Fetch the parsed report once the prereq task reaches a terminal state. */
  getPrereqResult(taskId: string): Promise<PrereqReport>;

  /** Run project setup (the init wizard); returns the task id to subscribe to. */
  runInit(input: InitInput): Promise<{ taskId: string }>;

  /** Fetch the init outcome once the init task reaches a terminal state. */
  getInitResult(taskId: string): Promise<InitResult>;

  /** Snapshot any task (state + bounded log tail). */
  getTaskSnapshot(taskId: string): Promise<TaskSnapshot | null>;

  /** Request cancellation of a running task. */
  cancelTask(taskId: string): Promise<void>;

  /** Subscribe to a task's streamed events. Returns an unsubscribe disposer. */
  onTaskEvent(taskId: string, cb: (event: TaskEvent) => void): () => void;
}
