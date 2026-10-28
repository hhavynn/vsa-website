/**
 * Narrow, reviewable exceptions for the automated public-route axe baseline.
 * Never disable a rule globally to unblock CI.
 */
export type AxeTheme = 'light' | 'dark';

export interface AxeNode {
  target: Array<string | string[]>;
  failureSummary?: string | null;
}

export interface AxeViolation {
  id: string;
  impact?: string | null;
  help: string;
  helpUrl?: string;
  nodes: AxeNode[];
}

export interface AxeException {
  ruleId: string;
  route: string;
  theme: AxeTheme;
  /** Exact axe node CSS-selector chain; never '*' or a prefix wildcard. */
  target: Array<string | string[]>;
  /** Evidence that the specific finding is a false positive, not just inconvenient. */
  reason: string;
  issueUrl: string;
  /** YYYY-MM-DD UTC; CI fails if an exception is out of date. */
  expiresOn: string;
}

/**
 * Intentional empty baseline. For a genuine, independently reviewed false
 * positive add an exact node exception with an issue link, rationale, and
 * expiry. All other nodes of that same axe rule continue to fail CI.
 */
export const AXE_EXCEPTIONS: readonly AxeException[] = [];

function validateException(entry: AxeException, today: string) {
  if (!entry.route.startsWith('/') || entry.route.includes('*') ||
      !entry.ruleId || entry.ruleId.includes('*') ||
      !['light', 'dark'].includes(entry.theme) ||
      entry.target.length === 0 || entry.target.some((part) => {
        const selectors = Array.isArray(part) ? part : [part];
        return selectors.length === 0 || selectors.some((selector) => !selector.trim() || selector.includes('*'));
      }) ||
      entry.reason.trim().length < 20 ||
      !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(entry.issueUrl) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresOn) ||
      !Number.isFinite(Date.parse(entry.expiresOn + 'T00:00:00Z'))) {
    throw new Error('Invalid axe exception: exact rule, route, theme, CSS target, rationale, issue and expiry are required');
  }
  if (today > entry.expiresOn) {
    throw new Error(`Expired axe exception ${entry.ruleId} at ${entry.route} (${entry.expiresOn}): ${entry.issueUrl}`);
  }
}

export function withoutReviewedFalsePositives<T extends AxeViolation>(
  violations: T[],
  route: string,
  theme: AxeTheme,
  exceptions: readonly AxeException[] = AXE_EXCEPTIONS,
  today: string = new Date().toISOString().slice(0, 10),
): T[] {
  for (const entry of exceptions) validateException(entry, today);

  return violations.flatMap((violation) => {
    const nodes = violation.nodes.filter((node) => !exceptions.some((entry) =>
      entry.route === route &&
      entry.theme === theme &&
      entry.ruleId === violation.id &&
      JSON.stringify(entry.target) === JSON.stringify(node.target)
    ));
    return nodes.length > 0 ? [{ ...violation, nodes }] : [];
  });
}

export function formatAxeViolations(violations: AxeViolation[]): string {
  return violations.map((violation) =>
    [
      `${violation.impact?.toUpperCase() ?? 'UNKNOWN'}: ${violation.id} — ${violation.help}`,
      violation.helpUrl ? `  Rule and guidance: ${violation.helpUrl}` : '',
      ...violation.nodes.map((node) =>
        `  Element: ${node.target.map((part) => Array.isArray(part) ? part.join(' > ') : part).join(' > ')}\n  How to fix: ${node.failureSummary?.trim() || 'Inspect the rule guidance and update this exact element.'}`),
    ].filter(Boolean).join('\n')
  ).join('\n');
}
