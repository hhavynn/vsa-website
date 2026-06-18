# Claude Subagent Task Template (VSA Website)

Copy this template when asking Claude to work with a VSA subagent. Fill in every field. Keep tasks scoped to one domain/subagent where possible.

```
Subagent to use:
  <e.g. vsa-house-system>

Goal:
  <one clear sentence describing the desired outcome>

Current problem:
  <what's wrong now, with the route/page/file if known>

Scope:
  <exactly what may change>

Out of scope:
  <what must NOT change — protected logic, schema, RLS, other domains>

Likely files:
  <best-guess files/paths; the subagent can confirm>

Safety rules:
  - No schema / RLS / migration changes
  - No changes to attendance import, points, House membership, or leaderboard logic
  - No private/admin data exposed on public routes
  - No secrets, env values, or real application links hardcoded
  - No fake events, members, points, standings, or links
  - Audit-first: report root cause before editing when unclear

Acceptance criteria:
  - <observable, testable outcome 1>
  - <observable, testable outcome 2>

Verification commands:
  - npm run build
  - npm run lint
  - CI=true npm test -- --watchAll=false

Manual QA:
  - <route(s) to visit and what to confirm>
  - <public vs admin behavior to verify, if relevant>

Final response format:
  - Root cause (if a bug)
  - Files changed
  - What changed and why
  - Verification results
  - Manual QA notes / anything to review
```

## Filled example

```
Subagent to use:
  vsa-events-gallery

Goal:
  Fix the Google Calendar button overflowing on event cards on mobile.

Current problem:
  On /events, the "Add to Google Calendar" button overflows its card on
  narrow screens.

Scope:
  Event card button layout/styling only.

Out of scope:
  Event data, publish/draft filtering, points, schema, RLS.

Likely files:
  src/pages/Events.tsx and the event card component/styles.

Safety rules:
  - Smallest safe UI fix
  - No exposure of check-in codes
  - No fake events

Acceptance criteria:
  - Button stays within the card on mobile and desktop
  - No regression to other event card content

Verification commands:
  - npm run build
  - npm run lint
  - CI=true npm test -- --watchAll=false

Manual QA:
  - Load /events at mobile and desktop widths; confirm button fits

Final response format:
  - Files changed, what changed, verification results, QA notes
```
