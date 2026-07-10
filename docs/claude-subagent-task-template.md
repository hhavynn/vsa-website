# Claude Internal Specialist Task Template (VSA Website)

The parent agent fills this template after inferring the workflow from the user's natural-language request. Users do not need to name a subagent or provide these fields. Keep one coherent concern per specialist.

```
Subagent to use:
  <e.g. vsa-house-system>

Goal:
  <one clear sentence describing the desired outcome>

Current problem:
  <what's wrong now, with the route/page/file if known>

Owned files or subsystem:
  <exact ownership boundary>

Forbidden files or systems:
  <what must NOT change — shared files, protected logic, schema, RLS, other domains>

Likely files:
  <best-guess files/paths; the subagent can confirm>

Relevant invariants and constraints:
  <only the architecture, privacy, security, and domain rules this concern needs>

Targeted context:
  <specific Graphify findings and source/Repomix excerpts; never the full transcript or repository>

Permission:
  <read-only or edit>

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

Focused verification:
  - <smallest test/reproduction proving owned behavior>
  - <broader check only if this concern owns the question>

Expected deliverable:
  <diff/report, evidence, concerns, and exact files touched>

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

Owned files or subsystem:
  Event card button layout/styling only.

Forbidden files or systems:
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

Focused verification:
  - Inspect the affected event-card component diff
  - Load /events at mobile and desktop widths; confirm button fits

Manual QA:
  - Load /events at mobile and desktop widths; confirm button fits

Final response format:
  - Files changed, what changed, verification results, QA notes
```
