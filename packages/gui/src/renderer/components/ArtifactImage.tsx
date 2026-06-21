import { useEffect, useState } from 'react';
import { bridge } from '../api/bridge';

/** Loads a QA PNG through the sandboxed bridge and renders it (with loading/missing states). */
export function ArtifactImage({ relPath, alt }: { relPath: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    bridge()
      .readQaImage(relPath)
      .then((d) => {
        if (active) {
          setSrc(d);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [relPath]);

  if (!loaded) return <div className="art-img art-img-state">loading…</div>;
  if (!src) return <div className="art-img art-img-state">not found</div>;
  return <img className="art-img" src={src} alt={alt} loading="lazy" />;
}
