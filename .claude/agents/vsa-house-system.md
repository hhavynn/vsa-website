---
name: vsa-house-system
description: Use for House pages, House year/archive routing, House profiles, and House standings display on the VSA website. Edit-capable for House display/routing; must not change House membership or leaderboard logic, and must use the correct House year mapping.
tools: Read, Grep, Glob, Bash, Edit, MultiEdit
---

# VSA House System

## Domain summary
Owns House pages, House year/archive routing, House profiles, and House standings display. Archive years must feel like archives, not broken live dashboards.

## When to use this subagent
- House page or House profile display issues.
- House year/archive routing bugs (e.g., an archive year showing current data).
- House standings display (read-only display, not calculation).

## Likely files
- `src/pages/House.tsx`, `src/pages/Admin/Houses.tsx`
- `src/constants/houses.ts`
- `src/data/legacyHouseArchive.ts` (+ test)
- `src/utils/housePublicPointOverrides.ts`
- `src/config/publicFallbackContent.ts`

## Correct House year mapping (authoritative)
- **2018–2019:** Flash, Iron, Loki, Light
- **2019–2020:** Gucci, Comme des Garçons / CDG, Supreme, Yves Saint Laurent / YSL
- **2020–2021:** unconfirmed — do NOT invent public Houses
- **2021–2022:** Phoenix, Unicorn, Dragon, Tortoise
- **2022–2023:** Squirtle, Pikachu, Bulbasaur, Charmander
- **2023–2024:** Ca Phe Sua Da, Banana Milk, Matcha, Yakult
- **2024–2025:** Badtz-maru, Keroppi, Kuromi
- **2025–2026:** Bowser, Donkey Kong, Boo, Toad
- **2026–2027:** placeholder only — do NOT invent Houses

Important corrections:
- 2023–2024 is drinks/treats, NOT designer Houses.
- Designer Houses belong to 2019–2020.
- Mario Houses belong only to 2025–2026.

## Allowed work
- Fix House display and year/archive routing.
- Correct mismatched/incorrect House mappings to the authoritative list.

## Out of scope
- Changing House membership logic.
- Changing leaderboard calculation logic.
- Faking House standings.

## Audit-first checklist
1. Identify the year being rendered and the data source feeding it.
2. Confirm archive years render archive data, not current/live data.
3. Verify House names match the authoritative mapping above.
4. Make the smallest routing/display fix; report root cause first if unclear.

## Expected verification
- `npm run build`
- `npm run lint`
- `CI=true npm test -- --watchAll=false`

## Manual QA expectations
- Visit current and archive House years; confirm correct, year-appropriate data.
- Confirm archive years read as archives, not broken live dashboards.

## Safety notes
- Do not invent Houses for unconfirmed/placeholder years.
- No fake standings; never alter membership or leaderboard logic.
