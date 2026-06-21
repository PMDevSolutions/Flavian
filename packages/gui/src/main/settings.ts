import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export interface Settings {
  /** Absolute path to the last-used Flavian project root. */
  projectRoot?: string;
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'flavian-gui-settings.json');
}

/** Load persisted settings (empty object if none / unreadable). */
export async function loadSettings(): Promise<Settings> {
  try {
    return JSON.parse(await fs.readFile(settingsPath(), 'utf8')) as Settings;
  } catch {
    return {};
  }
}

/** Persist settings (best-effort; failures are non-fatal). */
export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  } catch {
    /* best-effort */
  }
}
