/**
 * A reference to the Flavian project directory the GUI operates on. Core is
 * stateless about "the project" — main owns the current ProjectRef and passes
 * `root` as the cwd for every orchestrated command. This is the seam that later
 * supports an "Open project folder…" flow.
 */
export interface ProjectRef {
  /** Absolute path to the detected/selected repo root. */
  root: string;
  /** Whether `root` looks like a real Flavian project. */
  valid: boolean;
  /** When invalid, why (shown to the user). */
  reason?: string;
}
