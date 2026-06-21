import type {
  PrereqGroup,
  PrereqItem,
  PrereqReport,
  PrereqStatus,
  PrereqSummary,
} from '../../shared/types/prerequisites';
import { guidanceFor } from './prereq-metadata';

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;

const GROUP_HEADERS: Record<string, PrereqGroup> = {
  'REQUIRED SOFTWARE': 'required-software',
  'REQUIRED ACCOUNTS': 'required-accounts',
  'OPTIONAL SOFTWARE': 'optional-software',
  'SYSTEM REQUIREMENTS': 'system-requirements',
};

const STATUS_TAGS: Record<string, PrereqStatus> = {
  PASS: 'pass',
  FAIL: 'fail',
  SKIP: 'skip',
  INFO: 'info',
};

const STATUS_LINE = /^\[(PASS|FAIL|SKIP|INFO)\]\s+(.*)$/;
const SUMMARY_LINE = /^(Required|Optional|System):\s+(\d+)\/(\d+)/;

const RECOGNIZERS: Array<[RegExp, string, string]> = [
  [/^Git\b/i, 'git', 'Git'],
  [/^Docker\b/i, 'docker', 'Docker'],
  [/^Claude Code\b/i, 'claude', 'Claude Code'],
  [/^GitHub CLI\b/i, 'gh', 'GitHub CLI'],
  [/^WP-CLI\b/i, 'wp', 'WP-CLI'],
  [/^Node\.js\b/i, 'node', 'Node.js'],
  [/^PHP\b/i, 'php', 'PHP'],
  [/^Composer\b/i, 'composer', 'Composer'],
  [/^RAM\b/i, 'ram', 'RAM'],
  [/^Disk\b/i, 'disk', 'Disk'],
  [/^OS\b/i, 'os', 'OS'],
];

function recognize(detail: string): { key: string; label: string } | undefined {
  for (const [re, key, label] of RECOGNIZERS) {
    if (re.test(detail)) return { key, label };
  }
  return undefined;
}

function extractVersion(detail: string): string | undefined {
  const withoutMin = detail.replace(/\(minimum:[^)]*\)/i, '');
  const m = /\b(\d+\.\d+(?:\.\d+)?)\b/.exec(withoutMin);
  return m ? m[1] : undefined;
}

function extractMinVersion(detail: string): string | undefined {
  const m = /minimum:\s*(\d+\.\d+(?:\.\d+)?)/i.exec(detail);
  return m ? m[1] : undefined;
}

/**
 * Parse the output of `scripts/check-prerequisites.sh` into a structured report.
 * Strips ANSI, tracks the current section, classifies [PASS]/[FAIL]/[SKIP]/[INFO]
 * lines, attaches indented continuation lines as hints, parses the summary block,
 * and derives `ready` from the script's exit-code contract (cross-checked).
 */
export function parsePrereqOutput(raw: string, exitCode: number | null): PrereqReport {
  const cleaned = raw.replace(ANSI, '');
  const lines = cleaned.split(/\r?\n/);

  const items: PrereqItem[] = [];
  const summary: PrereqSummary = {
    requiredPassed: 0,
    requiredTotal: 0,
    optionalInstalled: 0,
    optionalTotal: 0,
    systemPassed: 0,
    systemTotal: 0,
  };

  let group: PrereqGroup = 'unknown';
  let reachedSummary = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed === '=== Summary ===') {
      reachedSummary = true;
      continue;
    }

    if (GROUP_HEADERS[trimmed] !== undefined) {
      group = GROUP_HEADERS[trimmed];
      continue;
    }

    const status = STATUS_LINE.exec(trimmed);
    if (status) {
      const detail = status[2].trim();
      const rec = recognize(detail);
      const st = STATUS_TAGS[status[1]];
      items.push({
        group,
        status: st,
        key: rec?.key,
        label: rec?.label ?? detail.split(/\s+/)[0],
        detail,
        version: extractVersion(detail),
        minVersion: extractMinVersion(detail),
        hints: [],
        guidance: st === 'fail' ? guidanceFor(rec?.key) : undefined,
      });
      continue;
    }

    const sum = SUMMARY_LINE.exec(trimmed);
    if (sum) {
      reachedSummary = true;
      const got = Number(sum[2]);
      const total = Number(sum[3]);
      if (sum[1] === 'Required') {
        summary.requiredPassed = got;
        summary.requiredTotal = total;
      } else if (sum[1] === 'Optional') {
        summary.optionalInstalled = got;
        summary.optionalTotal = total;
      } else {
        summary.systemPassed = got;
        summary.systemTotal = total;
      }
      continue;
    }

    // Indented continuation line → a hint on the preceding item (but not once we've
    // entered the summary/footer region, whose indented "1. 2. 3." steps aren't hints).
    if (!reachedSummary && /^\s+\S/.test(rawLine) && trimmed !== '' && items.length > 0) {
      items[items.length - 1].hints.push(trimmed);
    }
  }

  const hasBlockingFail = items.some(
    (i) =>
      i.status === 'fail' &&
      (i.group === 'required-software' ||
        i.group === 'required-accounts' ||
        i.group === 'system-requirements'),
  );

  return {
    items,
    summary,
    ready: exitCode === 0 && !hasBlockingFail,
    exitCode,
    raw: cleaned,
  };
}
