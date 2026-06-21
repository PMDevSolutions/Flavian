import { useEffect, useState } from 'react';
import { bridge } from '../api/bridge';
import type { TaskEvent, TaskState } from '../../shared/types/task';

export interface TaskStream {
  lines: string[];
  state: TaskState | null;
  exitCode: number | null;
}

/** Subscribe to a task's streamed events, accumulating log lines and tracking state. */
export function useTaskStream(taskId: string | null): TaskStream {
  const [lines, setLines] = useState<string[]>([]);
  const [state, setState] = useState<TaskState | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);

  useEffect(() => {
    if (!taskId) return;
    setLines([]);
    setState('running');
    setExitCode(null);
    const dispose = bridge().onTaskEvent(taskId, (event: TaskEvent) => {
      if (event.kind === 'log') {
        setLines((prev) => [...prev, event.line]);
      } else {
        setState(event.state);
        if (event.exitCode !== undefined) setExitCode(event.exitCode);
      }
    });
    return dispose;
  }, [taskId]);

  return { lines, state, exitCode };
}
