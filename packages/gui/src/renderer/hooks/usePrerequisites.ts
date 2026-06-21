import { useCallback, useEffect, useState } from 'react';
import { bridge } from '../api/bridge';
import type { PrereqReport } from '../../shared/types/prerequisites';
import { useTaskStream } from './useTaskStream';

export interface PrereqController {
  report: PrereqReport | null;
  error: string | null;
  running: boolean;
  lines: string[];
  run: () => void;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Drives a prerequisite check: start it, stream its log, then fetch the parsed report. */
export function usePrerequisites(): PrereqController {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [report, setReport] = useState<PrereqReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stream = useTaskStream(taskId);

  const run = useCallback(() => {
    setReport(null);
    setError(null);
    setTaskId(null);
    bridge()
      .runPrereqCheck()
      .then(({ taskId }) => setTaskId(taskId))
      .catch((e) => setError(message(e)));
  }, []);

  useEffect(() => {
    if (!taskId) return;
    if (stream.state === 'succeeded' || stream.state === 'failed') {
      bridge()
        .getPrereqResult(taskId)
        .then(setReport)
        .catch((e) => setError(message(e)));
    }
  }, [taskId, stream.state]);

  const running = taskId !== null && report === null && error === null;

  return { report, error, running, lines: stream.lines, run };
}
