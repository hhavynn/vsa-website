---
name: vsa-applications-forms
description: Use for admin-managed application windows (ACE, House Fall/Winter/Spring, Intern, Cabinet, VCN Stage Ninja, VCN Props, WNC team forms) on the VSA website. Edit-capable; closed/future URLs must never be exposed publicly and no real links may be hardcoded.
tools: Read, Grep, Glob, Bash, Edit, MultiEdit
---

# VSA Applications & Forms

## Domain summary
Owns admin-managed application windows for ACE, House Fall/Winter/Spring, Intern, Cabinet, VCN Stage Ninja, VCN Props, and WNC team forms. Public pages should only receive a target URL when a window is active.

## When to use this subagent
- Application window open/close behavior.
- Public pages exposing (or failing to expose) application links.
- Admin UI for managing application windows.

## Likely files
- `src/lib/applicationLinks.ts`
- `src/types/index.ts`, `src/types/database.ts`
- `src/pages/Ace.tsx`, `src/pages/House.tsx`, `src/pages/Internship.tsx`, `src/pages/Cabinet.tsx`, `src/pages/WildNCulture.tsx`, `src/pages/VcnCurrent.tsx`
- Admin application-window management UI

## Supported keys
- `ace_application`
- `house_fall`
- `house_winter`
- `house_spring`
- `intern_application`
- `cabinet_application`
- `vcn_stage_ninja_interest`
- `vcn_props_team_interest`
- `wnc_team_form`

## Important rules
- Closed/future application URLs must NOT be exposed publicly.
- Public pages should only receive target URLs when windows are ACTIVE.
- Open dates CAN be in the past.
- Due/close date defaults to 11:59 PM unless edited.
- NO hardcoded real application links in public page files.
- Do NOT create fake application URLs.

## Allowed work
- Edit application-window resolution/gating logic and admin UI.
- Fix public exposure bugs (links showing when window is closed/future).

## Out of scope
- Schema/RLS changes; attendance/points/House/leaderboard logic.
- Hardcoding real links or inventing URLs.

## Audit-first checklist
1. Confirm the active-window check gates public URL exposure.
2. Confirm closed/future windows return no public target URL.
3. Confirm no real link is hardcoded in a public page file.
4. Verify default close time (11:59 PM) behavior is intact.

## Expected verification
- `npm run build`
- `npm run lint`
- `CI=true npm test -- --watchAll=false`

## Manual QA expectations
- Toggle a window active/closed/future; confirm public link appears only when active.
- Confirm admin can manage windows without leaking closed/future URLs publicly.

## Safety notes
- No fake URLs. No hardcoded real links in public files. No secrets.
