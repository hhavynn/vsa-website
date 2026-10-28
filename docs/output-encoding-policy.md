# Browser output-encoding guard

Issue #350 records the distinction between frontend UX validation and server/database boundary validation. This document covers only **output encoding**, not that entire server-validation inventory.

## Current browser policy

React escapes text rendered through ordinary JSX expressions. App code must not bypass that default by using `dangerouslySetInnerHTML`, and it must never build raw HTML from user-submitted input. The repository's `eslintConfig` includes `react/no-danger: error`, enforced by `npm run lint` in pull-request CI. The rule targets unsafe JSX insertion; reviewers should also reject raw `innerHTML` assignments and undocumented imperative HTML sinks.

To verify locally:

```sh
npm run lint
git grep -n -E 'dangerouslySetInnerHTML|\\.innerHTML\\s*=' -- src || true
```

Review each resulting match; no finding in `src/` currently requires an exception. The grep is a reviewer diagnostic, **not** a substitute for lint, and a clean result is not a proof against every possible injection route. If future content genuinely needs rich HTML, treat that as a separately reviewed trust-boundary change with safe parsing/sanitization, security review and tests. Do not suppress `react/no-danger` to work around rendering.

## Other input-validation boundaries remain open

Client-side Zod errors are UX. Edge Functions must bound and validate JSON bodies and privileged authorization before making calls, and Supabase constraints/RLS must enforce the real data boundary. Refer to [auth model](auth-model.md), [RLS verification checklist](rls-verification-checklist.md) and issue [#350](https://github.com/hhavynn/vsa-website/issues/350) for the outstanding field-by-field inventory, adversarial cases and server-side size limits. **This guard does not complete those requirements.**
