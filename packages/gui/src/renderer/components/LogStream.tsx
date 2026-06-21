import { useEffect, useRef } from 'react';

/** A scrolling, auto-following view of streamed log lines. Reused by every task UI. */
export function LogStream({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);
  return (
    <pre className="log-stream" ref={ref}>
      {lines.length === 0 ? 'Waiting for output…' : lines.join('\n')}
    </pre>
  );
}
