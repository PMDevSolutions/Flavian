import type { DockerService } from '../../shared/types/docker';

interface ComposePsRow {
  Name?: string;
  Service?: string;
  State?: string;
  Status?: string;
  Ports?: string;
  Publishers?: Array<{ PublishedPort?: number; TargetPort?: number; Protocol?: string }>;
}

function portsOf(row: ComposePsRow): string {
  if (row.Ports) return row.Ports;
  if (row.Publishers) {
    return row.Publishers.filter((p) => p.PublishedPort)
      .map((p) => `${p.PublishedPort}->${p.TargetPort}/${p.Protocol ?? 'tcp'}`)
      .join(', ');
  }
  return '';
}

/**
 * Parse `docker compose ps --format json`. Compose v2 emits either a JSON array
 * or newline-delimited JSON objects depending on version — handle both.
 */
export function parseComposePs(raw: string): DockerService[] {
  const text = raw.trim();
  if (!text) return [];

  const rows: ComposePsRow[] = [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) rows.push(...(parsed as ComposePsRow[]));
    else rows.push(parsed as ComposePsRow);
  } catch {
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        rows.push(JSON.parse(trimmed) as ComposePsRow);
      } catch {
        /* skip non-JSON noise */
      }
    }
  }

  return rows.map((r) => ({
    name: r.Name ?? '',
    service: r.Service ?? '',
    state: r.State ?? '',
    status: r.Status ?? '',
    ports: portsOf(r),
  }));
}
