import { useCallback, useEffect, useState } from 'react';
import { bridge } from '../api/bridge';
import type { PipelineInput, PipelineResult } from '../../shared/types/pipeline';
import { useTaskStream } from './useTaskStream';

export interface PipelineController {
  result: PipelineResult | null;
  error: string | null;
  running: boolean;
  lines: string[];
  run: (input: PipelineInput) => void;
  cancel: () => void;
  reset: () => void;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Drives a conversion: launch the pipeline, stream its output, fetch the outcome. */
export function usePipeline(): PipelineController {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stream = useTaskStream(taskId);

  const run = useCallback((input: PipelineInput) => {
    setResult(null);
    setError(null);
    setTaskId(null);
    bridge()
      .runPipeline(input)
      .then(({ taskId }) => setTaskId(taskId))
      .catch((e) => setError(message(e)));
  }, []);

  const cancel = useCallback(() => {
    if (taskId) void bridge().cancelTask(taskId);
  }, [taskId]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setTaskId(null);
  }, []);

  useEffect(() => {
    if (!taskId) return;
    if (stream.state === 'succeeded' || stream.state === 'failed' || stream.state === 'cancelled') {
      bridge()
        .getPipelineResult(taskId)
        .then(setResult)
        .catch((e) => setError(message(e)));
    }
  }, [taskId, stream.state]);

  const running = taskId !== null && result === null && error === null;

  return { result, error, running, lines: stream.lines, run, cancel, reset };
}
