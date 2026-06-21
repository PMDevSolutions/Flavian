import type { PrereqGuidance } from '../../shared/types/prerequisites';

/**
 * Curated remediation copy keyed by canonical tool key. Used to enrich failing
 * prerequisites with actionable guidance, independent of the exact hint text the
 * bash script happens to print. Single place to maintain install instructions.
 */
export const PREREQ_GUIDANCE: Record<string, PrereqGuidance> = {
  git: { text: 'Install Git 2.30 or newer.', url: 'https://git-scm.com/downloads' },
  docker: {
    text: 'Install Docker Desktop and make sure the daemon is running.',
    url: 'https://docs.docker.com/desktop/',
  },
  claude: {
    text: 'Install Claude Code: npm install -g @anthropic-ai/claude-code',
    url: 'https://claude.ai/code',
  },
  gh: { text: 'Install the GitHub CLI, then run `gh auth login`.', url: 'https://cli.github.com/' },
  wp: {
    text: 'WP-CLI is optional — Docker bundles it internally.',
    url: 'https://wp-cli.org/#installing',
  },
  node: { text: 'Install Node.js 18 or newer.', url: 'https://nodejs.org/' },
  php: { text: 'PHP is optional — Docker provides it internally.', url: 'https://www.php.net/downloads' },
  composer: { text: 'Install Composer.', url: 'https://getcomposer.org/download/' },
  ram: { text: 'Free up memory — at least 8 GB of RAM is recommended.' },
  disk: { text: 'Free up disk space — at least 10 GB free is recommended.' },
  os: { text: 'Use a supported OS: Windows, macOS, or Linux.' },
};

export function guidanceFor(key: string | undefined): PrereqGuidance | undefined {
  return key ? PREREQ_GUIDANCE[key] : undefined;
}
