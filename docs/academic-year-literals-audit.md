# Academic-year literals audit

**Scope / evidence:** `main` at `b168ecfc` (2026-10-27), issue [#267](https://github.com/hhavynn/vsa-website/issues/267). Read all 12 files from the issue's original candidate list, then cross-checked the current 799 TypeScript/TSX source-file paths and searched for `2025-2026` and `2026-2027` references. This is a **bounded editorial/source audit**, not a proof that every possible numeric year literal anywhere in the repo was found. Tests, SQL migrations and dated runbooks intentionally contain historical examples; they are not candidates for runtime rollover.

Every operational reference below has exactly one classification:

- **A — Derive it:** dynamic current-year state that should use the academic-term model; issue required.
- **B — Per-year editorial:** intentional static current/published edition that needs a seasonal checklist step.
- **C — Historical:** a year-specific archive, verified override or contextual historical explanation; never date-derive.
- **D — Admin-managed:** content is, or should be, controlled through an editor/database row instead of changing a source string.

## Original 12-file list — source-verified

| Source and relevant lines | Class | Evidence and rationale | Follow-up |
| --- | :---: | --- | --- |
| `src/components/layout/navigation/navConfig.ts` | **B** | No literal year in current source: Wrapped nav has already been changed to read the *published edition* label from `wrappedEdition` (#263). Its visible year is editorial rather than today's date. | Rollover **only** when the next Wrapped edition is published. |
| `src/data/wrapped2026.ts:31-36` | **B** | Explicit `academicYearStart: 2025` and `windowStart/windowEnd` describe the 2025–26 edition; archives must not be rewritten by the current clock. | Publish a new editorial edition/config on approval; retain 2026 original. |
| `src/components/features/home/WrappedRecapCard.tsx:3` | **B** | Reads `CURRENT_WRAPPED_YEAR_LABEL` from `wrappedEdition.ts` instead of hardcoding a second visible label. | Publish corresponding new recap artwork/copy in the same Wrapped rollover. |
| `src/components/features/house/HouseYearSelector.tsx:13-15` | **A** | `2026-2027` is hardcoded `Current`; the next academic year would still be labelled as current, even if live term records changed. Archive-specific routes are legitimate but mixed into the dynamic list. | **P1** [#595](https://github.com/hhavynn/vsa-website/issues/595), derive current designation and preserve real archival routes. |
| `src/components/features/points/PointsExplainer.tsx:112` | **C** | The Nov 8, 2025 House Reveal date describes *one historical year's* House-eligible points start, not a universal annual cutover. | Preserve as historical example; if the default explainer becomes misleading for new students, add clearly labeled year context in a separately reviewed copy PR. |
| `src/components/features/admin/ProgramContentManager.tsx` | **D** | No hardcoded year literal found; program content is edited through admin-managed content rather than per-year constants. | No literal to derive. Retain admin-controlled scheduling/content. |
| `src/config/publicFallbackContent.ts:34-51` | **B** | Static, explicitly *2025–26* public-safe Bowser/Donkey Kong/Toad/Boo House totals; must never be presented as fresh 2026–27 standings or silently re-labelled. | Rollover/degraded-mode review; prefer a labelled older-year snapshot or no live totals to invented values. |
| `src/config/publicFallbackContent.ts:64-94` | **C** | Verified legacy House-year list (2018–2025) is historical reference content. | Keep historical facts; correct only with evidence. |
| `src/components/layout/Footer.tsx` | **B** | No hardcoded academic-year literal in current source; the Wrapped label follows the edition through shared nav/footer data (#263). | Re-verify displayed label when a new Wrapped edition ships. |
| `src/components/common/PageSkeletons.tsx` | **C** | No academic-year literals found; skeleton UI placeholders do not encode a year to roll forward. | No change. |
| `src/data/legacyHouseArchive.ts:23-150` | **C** | Explicit historical House themes/years and routes are verified archival evidence; date-derived replacement would corrupt old eras. | **Never derive**; keep archival content intact. |
| `src/utils/housePublicPointOverrides.ts:18,43,63` | **C** | Official special-case *2025–26* House totals deliberately apply only to academicYearStart = 2025, not new years; altering them changes points presentation. | Preserve; no recalculation or extension to future Houses without an explicit approved decision. |
| `src/data/repos/uvsaNetworkSettings.ts:46` | **D** | `2025-2026 External Showcase` is merely the static **default** for the admin-editable `uvsa_network_page_settings` row. | Review the admin-managed live copy; source defaults only on a genuine missing record, and should not override saved content. |

## Additional runtime references found during source search

| Source | Class | Why / action |
| --- | :---: | --- |
| `src/data/wrappedEdition.ts:10` | **B** | Single published Wrapped edition label `2025–2026`; update along with approved new content, not on September 1. |
| `src/pages/House.tsx:502` | **A** | Current-year expression uses active term and calendar-derived metadata, but ends in stale literal `?? 2025`; it can misclassify archive/future states if the normal path fails. **P3** [#596](https://github.com/hhavynn/vsa-website/issues/596). |
| `src/pages/House.tsx:566` | **C** | Comment/usage of intentionally 2025–26 official public House overrides. Do not broaden the override. |
| `src/pages/Leaderboard.tsx:681-699` | **C** | The 2025–26 fallback is gated on `selectedYear === 2025`; it explicitly does *not* generate current 2026–27 standings. Keep year guard; review stale copy separately. |
| `src/pages/Admin/Members.tsx:429` | **C** | A code comment names the older 2025–26 roster as a warning, not a year used to derive the current filter. |
| `src/pages/Admin/AiKnowledge.tsx:930` | **D** | `2025-2026` appears only as an example placeholder for editable academic-year knowledge; the actual year is user-entered and validated separately. |
| `src/utils/calendar.ts:110` | **C** | Documents canonical 2025–26 House names in historical House-label handling, not current-year inference. |
| `src/lib/aiKnowledgeFreshness.ts:118,181` | **C** | `2026-2027` is an example accepted label/validation error message; no current-year determination is encoded. |
| `src/lib/housePlacementExport.ts:101` | **C** | A format example for an academic-year CSV filename; the actual export year is separately supplied. |

**Excluded by design:** fixture/test cases and historical SQL migrations, year-shaped event dates (not academic-year selection), version identifiers, and archival editorial docs. Those are not dynamic operational-year references and should not be mass-replaced.

## Ranked A issues — changes belong in separate PRs

1. **P1 / visible public UI — [#595](https://github.com/hhavynn/vsa-website/issues/595):** `HouseYearSelector` has a false Current badge/route at rollover. Test 2026–27, next term, no term, and verified historical House years. Do not invent unreleased House themes, memberships or reveals.
2. **P3 / last-resort fallback — [#596](https://github.com/hhavynn/vsa-website/issues/596):** `House.tsx` literal `2025` sentinel in a normally-derived expression. Maintain safe loading and archive classification when term metadata fails.

Neither fix is in this audit PR.

## B rollover checklist — run alongside #270 / #271

- [ ] Confirm a Wrapped edition is **actually published**, then update `wrappedEdition.ts`, the new edition-specific data/config and `WrappedRecapCard.tsx` together. Verify nav/footer/card labels are the *published edition* and do not advance just because the clock changed.
- [ ] Keep previous `wrapped2026.ts` intact as historical editorial content; verify the new edition's explicit year/window and image/copy approvals.
- [ ] Review static 2025–26 House fallbacks in `publicFallbackContent.ts` and the 2025-only `Leaderboard.tsx` branch; ensure degraded mode explicitly identifies the year or shows no standings. Never invent 2026–27 points or copy 2025 numbers.
- [ ] Check the admin UI/defaults for `uvsa_network_page_settings` seasonal showcase label before release; the saved DB row is the source of truth, and updating a source default does not update an existing row.
- [ ] Smoke-check House selector Current/Archive, Points Explainer year-specific copy, home Wrapped, footer, `/leaderboard` active/archival views and outage fallbacks at 320px/mobile and desktop.
- [ ] Do not touch `legacyHouseArchive.ts` or `housePublicPointOverrides.ts` to accomplish a current-year rollover. Check owner approval and seasonal publication gates first.

## Safety, verification, handoff

- Read current source, cross-checked paths in the GitHub tree and searched literals; **no code edits, query/points logic changes, database inspection, migrations or deployments** were performed.
- Date ranges/years in historical data must not be mass-refactored. Public fallback 2025–26 House totals represent a dated snapshot, not live 2026–27 data.
- Follow-up implementation requires its own change-control review for public House-adjacent display and manual browser validation; the audit itself does not imply a live-system defect has been reproduced.
