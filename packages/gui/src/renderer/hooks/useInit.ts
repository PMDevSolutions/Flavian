import { useCallback, useEffect, useState } from 'react';
import { bridge } from '../api/bridge';
import type { InitInput, InitResult } from '../../shared/types/init';
import { useTaskStream } from './useTaskStream';

export interface InitController {
  result: InitResult | null;
  error: string | null;
  running: boolean;
  lines: string[];
  run: (input: InitInput) => void;
  reset: () => void;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Drives a project-setup run: submit input, stream apply()'s log, fetch the outcome. */
export function useInit(): InitController {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<InitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stream = useTaskStream(taskId);

  const run = useCallback((input: InitInput) => {
    setResult(null);
    setError(null);
    setTaskId(null);
    bridge()
      .runInit(input)
      .then(({ taskId }) => setTaskId(taskId))
      .catch((e) => setError(message(e)));
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setTaskId(null);
  }, []);

  useEffect(() => {
    if (!taskId) return;
    if (stream.state === 'succeeded' || stream.state === 'failed') {
      bridge()
        .getInitResult(taskId)
        .then(setResult)
        .catch((e) => setError(message(e)));
    }
  }, [taskId, stream.state]);

  const running = taskId !== null && result === null && error === null;

  return { result, error, running, lines: stream.lines, run, reset };
}
