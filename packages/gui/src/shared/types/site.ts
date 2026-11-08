/**
 * Wix site lifecycle vocabulary. Vespasian's output is a live Wix site, not a
 * local server stack — so instead of supervising containers, the site screen
 * drives `bin/vespasian.mjs` subcommands and reflects connection state read
 * from the project's `.env` / `.vespasian/` (no network calls).
 */

/** Site operations, mapped 1:1 to `bin/vespasian.mjs` subcommands. */
export type SiteCommand =
  | 'list' // vespasian site list
  | 'use' // vespasian site use <site-id>   (writes WIX_SITE_ID into .env)
  | 'apply' // vespasian apply <plan.json>
  | 'publish' // vespasian publish
  ;

/**
 * Credential/connection state for the active project, derived locally from
 * `.env` and the editor-session file. Secrets are reported as booleans only —
 * the key itself never crosses the IPC boundary. Site/account GUIDs are ids,
 * not secrets, and are surfaced so the panel can build dashboard links.
 */
export interface WixSiteStatus {
  /** `.env` exists at the project root. */
  hasEnvFile: boolean;
  /** WIX_API_KEY is set (value never exposed). */
  hasApiKey: boolean;
  /** WIX_ACCOUNT_ID is set. */
  hasAccountId: boolean;
  /** WIX_SITE_ID — the default target site, or null. */
  siteId: string | null;
  /** WIX_METASITE_ID — used for dashboard/editor URLs, or null. */
  metasiteId: string | null;
  /** A persisted editor session (Playwright storageState) exists on disk. */
  editorSessionCaptured: boolean;
  /** VESPASIAN_DRY_RUN is enabled in .env. */
  dryRun: boolean;
}
