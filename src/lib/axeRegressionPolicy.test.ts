import {
  type AxeException,
  type AxeViolation,
  AXE_EXCEPTIONS,
  formatAxeViolations,
  withoutReviewedFalsePositives,
} from './axeRegressionPolicy';

const violation: AxeViolation = {
  id: 'aria-required-attr',
  impact: 'serious',
  help: 'ARIA widgets must have required attributes',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/aria-required-attr',
  nodes: [
    { target: ['#bad-one'], failureSummary: 'Fix any of the following: add the required aria-label' },
    { target: ['#bad-two'], failureSummary: 'Provide the required aria-expanded' },
  ],
};

const exception: AxeException = {
  ruleId: 'aria-required-attr',
  route: '/events',
  theme: 'dark',
  target: ['#bad-one'],
  reason: 'Independent review confirmed that this node is a documented axe false positive.',
  issueUrl: 'https://github.com/hhavynn/vsa-website/issues/315',
  expiresOn: '2026-12-31',
};

describe('axe false-positive exception policy (#315)', () => {
  const today = '2026-10-27';

  it('starts with no ignored findings or disabled rules', () => {
    expect(AXE_EXCEPTIONS).toEqual([]);
    expect(withoutReviewedFalsePositives([violation], '/events', 'dark', AXE_EXCEPTIONS, today))
      .toEqual([violation]);
  });

  it('suppresses only the reviewed exact node, not other violations of the same serious rule', () => {
    const result = withoutReviewedFalsePositives([violation], '/events', 'dark', [exception], today);
    expect(result).toHaveLength(1);
    expect(result[0].nodes).toEqual([violation.nodes[1]]);
  });

  it('only applies to the exact route and theme, not other routes or light mode', () => {
    expect(withoutReviewedFalsePositives([violation], '/house', 'dark', [exception], today)).toEqual([violation]);
    expect(withoutReviewedFalsePositives([violation], '/events', 'light', [exception], today)).toEqual([violation]);
  });

  it('keeps critical findings even when the selector matches but the rule differs', () => {
    const critical: AxeViolation = {
      ...violation,
      id: 'aria-hidden-focus',
      impact: 'critical',
      nodes: [violation.nodes[0]],
    };
    expect(withoutReviewedFalsePositives([critical], '/events', 'dark', [exception], today))
      .toEqual([critical]);
  });

  it('rejects wildcard selectors, missing evidence and expired exceptions', () => {
    const check = (item: AxeException) =>
      withoutReviewedFalsePositives([violation], '/events', 'dark', [item], today);
    expect(() => check({ ...exception, target: ['*'] })).toThrow(/Invalid axe exception/);
    expect(() => check({ ...exception, reason: 'ignore' })).toThrow(/Invalid axe exception/);
    expect(() => check({ ...exception, route: '*' })).toThrow(/Invalid axe exception/);
    expect(() => check({ ...exception, issueUrl: 'https://example.com' })).toThrow(/Invalid axe exception/);
    expect(() => check({ ...exception, expiresOn: '2026-01-01' })).toThrow(/Expired axe exception/);
  });

  it('prints the impact, rule, affected element, rule reference and how to fix', () => {
    const message = formatAxeViolations([violation]);
    expect(message).toContain('SERIOUS: aria-required-attr');
    expect(message).toContain('Element: #bad-one');
    expect(message).toContain('How to fix: Fix any of the following: add the required aria-label');
    expect(message).toContain('https://dequeuniversity.com/rules/axe/4.10/aria-required-attr');
  });

  it('keeps a useful fallback when axe cannot explain an individual node', () => {
    expect(formatAxeViolations([{ ...violation, nodes: [{ target: ['main button'] }] }]))
      .toContain('Inspect the rule guidance and update this exact element.');
  });
});
