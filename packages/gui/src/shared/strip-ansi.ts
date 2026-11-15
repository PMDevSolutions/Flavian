/**
 * Remove ANSI escape sequences (colors, cursor moves) from script output before it is shown as plain text.
 * wordpress-local.sh and the other scripts print colored banners; without this the log views showed raw codes
 * such as "[0;34m====[0m". Covers CSI sequences (ESC [ ... final byte) and the two-byte ESC forms.
 */
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b[@-Z\\-_]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}
