# Automated axe accessibility gate (#315)

The repository's existing `src/routes/accessibility.axe.test.tsx` runs in
`CI=true npm test -- --watchAll=false` via the normal PR checks. It renders
seven public routes (`/`, `/events`, `/leaderboard`, `/points`,
`/gallery`, `/house`, and `/get-involved`) in **light and dark** modes.
It waits for the real route and queries to settle before scanning the page.

**Failure policy:** every remaining `critical` or `serious` axe violation
fails CI. Moderate and minor violations remain visible in the warning
output with impact, rule ID, a CSS selector for each failing element,
rule guidance URL, and the axe `failureSummary` explaining the expected fix.
No `continue-on-error`, blanket rule disabling, or severity-wide exceptions.

## A true axe false positive

Fix real violations in their owning UI components. For an independently
confirmed false positive, add a **single exact-node** entry to
`AXE_EXCEPTIONS` in `src/lib/axeRegressionPolicy.ts`. A reviewer must see:

- The exact axe rule ID (not a category or `*`), page route and theme.
- The complete selector chain exactly as axe emitted it (not a wildcard).
- A concrete reason why **that node** is a false positive with supporting
  evidence, a tracked GitHub issue URL, and a specific expiration date.
- The expected unaffected nodes of the same rule, and which new regression
  would still fail CI.

The policy validates all exceptions on every scan: missing details or expired
entries fail the test rather than quietly hiding findings. Exempting a single
node cannot mask another instance or the same node on a different route or
theme. The default exception list is **empty**; no current violations are
silenced.

After an exemption's issue is resolved, remove the exception and rerun the
existing route test. Exception additions should be separate, explainable
changes with an owner review. Tests for this enforcement live in
`src/lib/axeRegressionPolicy.test.ts`.

## Limitations and manual follow-up

Axe in jsdom cannot faithfully test computed browser color contrast or the
experiences of users with actual screen readers and touch devices. Green
CI means **no current severe structural axe findings from these synthetic
routes**, not WCAG conformance. Real mobile, light/dark contrast, focus order,
screen-reader heading/landmark navigation and user journeys still need
manual verification as tracked by #317 and #321. Synthetic data is used in
test providers; do not paste real member content into test fixtures or CI logs.
