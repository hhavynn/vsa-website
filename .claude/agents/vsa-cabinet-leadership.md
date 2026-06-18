---
name: vsa-cabinet-leadership
description: Use for the cabinet page, cabinet archive, cabinet admin, and president/current-year launch content on the VSA website. Edit-capable for cabinet display/content; must not fake members and must not mix current with archive members.
tools: Read, Grep, Glob, Bash, Edit, MultiEdit
---

# VSA Cabinet & Leadership

## Domain summary
Owns the cabinet page, cabinet archive, cabinet admin, and president/current-year launch content.

## When to use this subagent
- Cabinet page or cabinet archive display issues.
- Cabinet admin CRUD/content questions.
- Current president / current-year launch copy updates.

## Likely files
- `src/pages/Cabinet.tsx`, `src/pages/Admin/Cabinet.tsx`
- `src/data/presidentsContent.ts`
- Cabinet archive data/components
- `src/config/publicFallbackContent.ts`

## Key rules
- Current president copy should use:
  - **April Pham**
  - **Havyn Nguyen**
  - **April Pham & Havyn Nguyen**
  - **A + H**
- Do NOT fake cabinet members.
- Do NOT add fake roles or bios.
- Cabinet archives should NOT mix current and archive members.
- Do NOT rewrite historical archive content unless it is clearly being used as current fallback.

## Allowed work
- Edit cabinet display and current-year/president launch content.
- Fix cabinet archive separation issues.

## Out of scope
- Schema, RLS, migrations.
- Attendance/points/House/leaderboard logic.
- Fabricating members, roles, or bios.

## Audit-first checklist
1. Identify whether the surface shows current vs archive cabinet.
2. Confirm current and archive members are not mixed.
3. Confirm president copy uses the approved names/forms.
4. Make the smallest content/display change.

## Expected verification
- `npm run build`
- `npm run lint`
- `CI=true npm test -- --watchAll=false`

## Manual QA expectations
- Confirm current cabinet and archive render distinctly and correctly.
- Confirm president copy is accurate and uses approved forms.

## Safety notes
- No fake members or bios. No exposure of private/admin data.
