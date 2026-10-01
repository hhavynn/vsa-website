---
name: vsa-validation-and-qa
description: Load before claiming any VSA-website change is "done" or "verified", when deciding who owns which checks, whether a change needs tests, when adding or modifying Jest tests, when a reviewer asks for acceptance criteria or manual QA evidence, or when routing to the right QA checklist (RLS, leaderboard, accessibility, route QA, degraded mode). Provides the proportional verification-ownership model, final-gate commands and acceptable-warning rule, golden test inventory, test-writing guidance, and manual-QA runbooks.
---

# VSA Validation & QA

**What this skill is for.** This is the definition of "verified" for the VSA website. It tells you exactly what evidence a change needs before it can be called done: which commands must pass, which warnings are acceptable, which tests exist and what they certify, when new tests are mandatory, and which manual-QA runbook to execute for your change type. The core stance: **"it compiles" is not evidence.** A green `tsc` pass proves only that the types line up — not that the leaderboard is right, the route loads, or the mobile drawer still opens.

**This skill is the canonical validation runbook.** `AGENTS.md`, `GEMINI.md`, `.github/CONTRIBUTING.md`, and `vsa-change-control` point here for the definitive matrix and carry at most a minimal pre-push summary — keep the authoritative command matrix and manual-QA runbooks here so they have one home. (The acceptable-warnings rule quoted in §1 is itself governed by `AGENTS.md` § Testing; this skill quotes it, it does not own it.)

**When NOT to use this skill:**

| If you need… | Go to |
|---|---|
| Whether a change is *allowed* at all (protected domains, never-do list, PR conventions) | `vsa-change-control` |
| Diagnosing *why* a build/test/page is failing | `vsa-debugging-playbook` |
| Running diagnostic tooling: `scripts/verify-rls-security.mjs`, bundle analysis, Lighthouse/axe, web-vitals | `vsa-diagnostics-and-measurement` |
| Writing or reviewing RLS policies and migrations themselves | `vsa-supabase-security-reference` |
| Jest/CRA environment breakage (`Unexpected token 'export'`, node version, env setup) | `vsa-build-and-env` |
| Full incident histories behind these rules | `vsa-failure-archaeology` |

Jargon used below — **RLS**: Row Level Security, Postgres per-row access policies (Supabase's authorization layer). **CRA**: Create React App, the build toolchain this site uses (`react-scripts`). **jsdom**: the simulated browser DOM Jest runs tests in. **Degraded mode**: the app's required behavior when Supabase is unreachable — public pages fall back to static content instead of crashing.

---

## 1. The evidence bar and ownership model

A change is verified when the checks assigned by its artifact type, behavior, integration surface, and risk all pass. Before running any check, identify the question it answers. Do not rerun an unchanged scope when successful evidence already answers that question and no relevant semantic change occurred.

### Ownership

- **Implementer:** run the smallest meaningful proof of owned behavior: the changed test file, affected component/integration test, or focused manual reproduction. Do not run the full suite/build by default unless shared infrastructure, concrete regression risk, or the task brief makes that broader question yours.
- **Reviewer:** read-only by default. Inspect the diff, acceptance criteria, invariants, and implementer evidence. Rerun only for a concrete unanswered doubt; an agent handoff does not invalidate evidence.
- **Parent/controller:** accept valid focused evidence. Run an integration check only when completed concerns interact, and own integration rather than delegating the whole result.
- **Final gate:** after semantic edits and formatting are complete, broaden once according to risk.

Preferred final-gate order:

```text
format
→ lint/static analysis relevant to changed artifacts
→ focused integration tests
→ broader relevant tests once
→ production build if application/runtime behavior changed
→ RLS/security checks if relevant
→ manual/browser checks if relevant
→ final review
```

The complete Jest suite (`CI=true npm test -- --watchAll=false`) is normally a final-gate check for cross-cutting/high-risk application changes, shared infrastructure, or CI—not documentation-only work, agent configuration, isolated copy, one narrow test change, or every subagent task. `npm run build` is required when application/runtime configuration, dependencies, or generated application behavior changed; it is not evidence for Markdown-only edits.

Formatting-only or whitespace-only changes do not invalidate broader successful evidence. A new run must answer a new question.

**Acceptable warnings.** AGENTS.md (§ Testing) states the rule exactly:

> "Existing jsdom, ThemeProvider, and Framer Motion console warnings are acceptable when the test command exits successfully."

That is the complete allowlist when Jest is part of the selected evidence. Exit code 0 with those warnings = pass. Any *new* warning class, or a nonzero exit, is a failure you must resolve — not annotate away.

**Why local verification is the real gate (as of 2026-07-06):**

- CI *does* run checks: `.github/workflows/deploy.yml` runs `npm run lint`, `CI=true npm test -- --coverage --watchAll=false`, and `npm run build` on `pull_request` targeting `main`.
- But `main` has **no branch protection**: `gh api repos/{owner}/{repo}/branches/main/protection` returns 404 "Branch not protected". Nothing on GitHub blocks a merge (or a direct push) when CI is red.
- AGENTS.md now states this distinction directly: CI runs, but it is not a protected merge gate while `main` remains unprotected. Proportional local verification is the enforcement mechanism.

Re-check branch protection if this ever changes:

```bash
gh api repos/{owner}/{repo}/branches/main/protection   # 404 = still unprotected
```

**What does NOT count as evidence:**

- "It compiles" / "TypeScript is happy" — type-checks only.
- "The dev server starts" — CRA dev builds are more permissive than `npm run build`.
- "Tests pass" alone — the suite covers a handful of pure-logic modules (section 2); your feature is almost certainly not in it.
- A screenshot of one viewport in one theme — see section 7 for the actual matrix.

---

## 2. Test inventory — the golden set (reviewed 2026-09-28; completeness enforced by `src/__meta__/testInventory.test.ts`)

Derive the current file set with `find src -name "*.test.ts*" | sort`; never trust a copied count. The inventory below explains what the current metadata, pure-logic, and smoke tests certify—and, more importantly, what nothing certifies.

| File | What it certifies | Why it exists |
|---|---|---|
| `src/__meta__/playbookRoster.test.ts` | The canonical `.claude/agents/README.md` registry lists exactly the playbook files present on disk, excluding `README.md`; detects omissions and dangling registry entries without hard-coding the roster in the test. | **Protects workflow metadata.** Harness adapters point to one canonical registry, so roster drift must fail CI instead of silently producing different routing across tools. |
| `src/data/repos/adminMembers.test.ts`, `src/components/features/admin/MemberWorkflow.test.tsx`, `src/pages/Admin/Import.file.test.tsx` | Manual member creation validates profile fields; attendance additions use configured event points (including zero), ignore duplicates and require a term; removals target one member/event pair; attendance dialogs confirm removal and refresh history/totals/caches; local Google Form CSVs reuse matching, duplicate handling, member creation and import audit metadata. | **Attendance workflow:** no check-in-table or cached-total writes. Mock tests do not certify live database triggers or RLS. |
| `src/App.test.tsx` | The full app (provider hierarchy + router) renders without throwing, against the mocked Supabase client from `setupTests.ts`. | Smoke test — catches provider-order breakage and import-time crashes in `App.tsx`. |
| `src/data/legacyHouseArchive.test.ts` | The House archive's exact year list (2018-2019 → 2025-2026); 2020-2021 is an `unconfirmed` gap with no Houses; 2019-2020 = designer Houses (Gucci, Comme des Garçons, Supreme, Yves Saint Laurent); 2023-2024 = beverage Houses (Ca Phe Sua Da, Banana Milk, Matcha, Yakult); 2024-2025 = three Sanrio Houses; the gap year is excluded from verified years. | **Protects domain facts.** House-year mapping has been repeatedly corrupted by agents inventing or shuffling Houses (AGENTS.md "Domain-critical facts" pins these years). This test makes the history executable — an agent that "fixes" the archive breaks the build. |
| `src/utils/seasonalState.test.ts` | Seasonal boundaries in America/Los_Angeles: summer break starts June 15 and ends September 15 (exclusive); `shouldUseSummerEmptyState` only fires when no active items exist. | **Protects domain facts.** The academic-year clock drives visible site behavior (empty states, seasonal content); off-by-one date bugs here silently change the public site twice a year. See `vsa-seasonal-operations` for the full clock. |
| `src/lib/applicationLinks.test.ts` | `getApplicationStatus` window logic: `disabled` when not enabled regardless of dates; `not_open` before open; `open` inside the window with both boundaries inclusive; `closed` after due. | **Risk-adjacent.** Governs whether an application window (and its URL) is exposed — enforces the "closed/future application URLs are never public" safety rule (AGENTS.md). |
| `src/lib/memberMatching.test.ts` | House-assignment cell parsing (strips preference rank/timestamps, handles quoted CSV commas, doesn't mistake preference for class year) and attendance-import matching (unique email → auto-match; duplicate email → review). | **Risk-adjacent to a protected domain.** This is the matching layer of attendance import; the import/points domain is audit-first (section 4; playbook agent `vsa-points-attendance-guardian`). |
| `src/utils/wrapped.test.ts` | `countEventsInWindow` (inclusive date-only window) and House-standings helpers: sort by total points descending without mutating input, winner selection, community-point sums. | **Leaderboard-adjacent.** Exercises standings ordering/winner logic used by VSA Wrapped. Does **not** test the canonical leaderboard calculation — that remains untested (see below). |
| `src/utils/calendar.test.ts` | Calendar date math across month boundaries without timezone shift; `vsaEventToCalendarItem` maps **only public-safe fields**; house/application → calendar-item mapping and tag normalization. | **Privacy-adjacent.** The "public-safe fields only" assertion guards against leaking non-public event data into the public calendar. |
| `src/lib/dateOnly.test.ts` | `toDateOnlyString` / `parseDateOnly`: parse `YYYY-MM-DD` as **local** calendar dates (no timezone shift), reject impossible dates (e.g. Feb 31), fall back to `parseISO` for other strings. | Date-only rendering has caused off-by-one display bugs; this pins the safe parsing behavior. |
| `src/schemas/dataRightsRequests.test.ts` | `DataRightsRequestFormSchema` / `DataRightsDependencyPreviewSchema`: accept only non-destructive, read-only metadata; reject destructive action fields, raw content, invalid identifiers, and oversized notes; require an independent reviewer. | **Privacy/safety.** Keeps the data-rights workflow read-only-by-construction (see `docs/data-rights-anonymization-runbook.md`). |
| `src/schemas/memberPhotoRequests.test.ts` | `MemberPhotoRequestFormSchema`: requires explicit `consent === true`; rejects missing name, invalid email, oversized notes, and unknown fields. | Enforces consent + input bounds on the public member-photo-request form. |
| `src/__meta__/skillsRoster.test.ts` | The `.claude/skills/README.md` routing table and the §6.4 roster in `vsa-docs-and-writing` both list exactly the `vsa-*` skill directories on disk; every backticked/bold `vsa-*` name in the governance docs resolves to a skill or playbook agent (#305). | **Protects workflow metadata**, like `playbookRoster.test.ts`. |
| `src/__meta__/testInventory.test.ts` | Every `*.test.ts(x)` file under `src/` has a row in this table, and every row points at a file that exists. | Keeps this inventory honest; it was months stale before this guard existed. |
| `src/routes/publicRoutes.smoke.test.tsx` | Every public route (incl. parameterised House/VCN routes, `/signin` redirect and the 404) mounts, renders exactly one live `<main>`, and settles past its loader (#294, #394). | **Catches blank or crashing pages** before `main` auto-deploys. |
| `src/pages/HouseYearRollover.test.tsx` | Before a new year's Houses are published, `/house` shows the not-announced state, and year-less House links redirect to the latest year that published that House (#412). | **Protects domain facts** during the yearly turnover. |
| `src/data/repos/events.test.ts`, `src/data/repos/houseEvents.test.ts` | Public event reads filter `is_published = true` (discovered by reflection, so new public methods are covered), admin reads see drafts, ordering, and permission errors surface (#291, #292). | **Privacy:** drafts never reach public pages. |
| `src/data/repos/draftLeakGuards.test.ts` | Same draft guard for ACE families, program content and VCN archives: public reads use a `published_*` view or filter `is_published`, admin reads see drafts (#292). | **Privacy.** |
| `src/data/repos/applicationLinks.test.ts` | Public application reads use only `public_application_links` and drop any URL for a non-open window, for all nine keys (#273). | **Safety rule:** closed/future application URLs are never public. |
| `src/lib/applicationWindowBoundaries.test.ts` | Admin-entered window times are San Diego time; every key flips at the exact open/close instant; DST boundaries; malformed or nonexistent times and close-before-open fail closed (#274). Also run under four machine TZs by `npm run test:timezones`. | **Safety rule** + timezone correctness. |
| `src/utils/seasonalBoundaries.test.ts` | Summer break flips at San Diego midnight on Jun 15 / Sep 15 (and not on the UTC date); active items suppress the summer empty state; each page renders its own summer copy (#270). Also run by `npm run test:timezones`. | **Domain facts:** the site's seasonal behaviour. |
| `src/data/repos/publicColumnAllowlists.test.ts` | The anon events projection excludes `check_in_form_url`; the admin projection keeps it; `updateEvent` never writes undefined fields (#379, #395). | **Privacy/regression.** |
| `src/pages/Admin/Members.photo.test.tsx` | Admin -> Members -> Edit shows the member's current approved photo, rejects unsupported file types, refuses to save or publish a selected photo until the admin confirms the member's consent, saves the member's details before publishing, cannot be closed while publishing, and keeps the dialog open with the photo selected when publishing fails. | **Privacy:** an admin cannot publish a member photo without attesting consent. |
| `src/data/repos/photoRequests.adminPublish.test.ts` | Admin -> Members photo publishing uploads the pending original and the public thumbnail before calling `admin_publish_member_photo`. On an RPC error it looks up the request row first: a row means a lost response, so the uploads are kept; an absent row deletes both; a failed lookup deletes nothing. Deletes that fail are reported with their paths, and non-JPEG/PNG/WebP files are rejected before uploading. | **Privacy/integrity:** no photo sits in the public `avatars` bucket without an audited, approved `member_photo_requests` row, and no approved row loses its image. |
| `src/data/repos/photoRequests.submit.test.ts` | Public photo submission requests a server-authorized single-object upload before writing Storage; invalid metadata, denied quotas, and upload failures stop the flow. | **Abuse prevention:** public clients never insert request rows or upload without a signed capability. |
| `src/components/ui/BottomSheet.test.tsx` | Modal sheets keep Tab and focus inside, restore their opener on dismissal, isolate background controls, and preserve existing scroll and inert state on cleanup. | **Mobile/accessibility:** calendar and leaderboard sheets remain usable with keyboard and assistive technology. |
| `src/hooks/useIndividualLeaderboard.test.tsx` | All-time standings refresh from the public projection every 30 seconds (paused in hidden tabs, refreshed on focus) without a raw `members` realtime event; overlapping polls are deduplicated, a stale all-time response never overwrites a newly selected year, and academic-year standings never poll. | **Freshness/privacy:** public standings stay live after raw member reads become admin-only. |
| `src/data/repos/academicTerms.test.ts`, `src/data/repos/houseMemberships.test.ts` | `ensureTermForDate` never overwrites admin-set term dates; House membership reads are constrained to the current year's effective interval. | **Data integrity** for terms and House display. |
| `src/data/errors.test.ts` | Supabase error payloads normalize correctly (not "Unknown error occurred"); `toUserMessage` never exposes table/column/policy names, `details` or `hint`, while passing through our own `RAISE` text and validation messages (#351, #410). | **Privacy/security:** no database internals in the UI. |
| `src/lib/imageUpload.test.ts` | An oversized upload is rejected with a `ValidationError`, so `toUserMessage` shows the actionable size limit instead of a generic retry message. | Public photo-request UX (#351 follow-up). |
| `src/lib/aceFamilyImport.test.ts` | The ACE fam JSON importer honours `big_id_hint` (a little attaches to the named same-named big; an unknown hint warns and makes a root), and every file in `data/ace-families/` imports with zero warnings and its exact people / link / root counts, parents before children, same-named people kept apart, Moon starting at its FA23 roots without AAF ancestry, the owner-confirmed lineage chains (2026-09-28) with no leftover alias spellings, and no little recorded in an earlier term than their big (four documented FA23 Bang Mi rows excepted). | Guards the reconstructed ACE family trees (see `docs/ace-family-imports.md`) against edits that silently drop or misattach members. |
| `src/lib/aceFamRoster.test.ts` | The ACE page's eight active fam slots (unique slugs, in order), every configured fam icon exists under `public/`, icon lookup by slug, and fam-head resolution: admin-labelled heads win, otherwise the roster heads (Sweatpants has one), borrowing a photo from a same-named tree member, and a linked tree member's shared approved avatar beats their ACE photo. | Guards the public fam lineup and heads against silent drift or broken icon paths. |
| `src/components/features/ace/FamTabs.test.tsx`, `src/components/features/ace/GhostFamCard.test.tsx` | The ACE page's active-fam tabs tell visitors how many fams exist (`N active fams`, `n / N`), a previous/next pager walks the lineup (no Previous on the first fam, no Next on the last), the tablist supports ArrowLeft/ArrowRight (wrapping), Home and End with a roving tabindex, and the panel is linked to its tab (`aria-controls`/`aria-labelledby`). Graveyard ghost cards drop the `(Dead)` name prefix, show member/gen counts, and open the fam's tree. | On phones only ~3 of 8 fam tabs fit on screen, and the page looked like only those 3 existed. |
| `src/components/features/ace/FamilyTree.test.tsx`, `src/components/features/ace/FamSheet.test.tsx` | Selecting an ACE tree member traces their real lineage root → … → them from the single-Big `parent_member_id` chain (stops at a Big missing from the tree or at a cycle; a Little whose Big is unpublished is laid out as a root). Only that path is lit and unrelated nodes/edges dim; the light is sequenced root-first within a fixed budget; selecting someone else replays it; reduced motion renders the lit path with zero delays and no travelling spark. The rail lists the lineage trail (ancestors jump-selectable), tapping the selected member again or Clear resets the tree, and Clear returns focus to that node. | The spotlight must never invent ancestry, and must not break selection, keyboard access, or the photo-request rail. |
| `src/components/features/admin/preview/PublicPreviewDialog.test.tsx`, `src/components/features/admin/preview/eventPreview.test.ts`, `src/components/features/admin/preview/cabinetPreview.test.ts`, `src/components/features/admin/preview/previewImageUrl.test.ts` | Admin "Preview As Public": the dialog is labeled as an unpublished preview, renders content inside its preview frame, blocks clicks/links/forms inside the preview, switches placements, and closes on Escape with focus restored. Draft events convert San Diego date/time exactly like the save path, carry no admin-only fields, and refuse a missing or non-existent (DST gap) start; draft Cabinet members replace their saved row (or join the selected year) in public sort order, include legacy rows only for the current year, and drop the linked photo on rename. Admin-typed preview image URLs keep only http(s), same-site paths, and local image data (no `javascript:`/protocol-relative), with markup characters escaped. | **Draft privacy:** a preview must never write (e.g. record event interest) or expose admin-only fields. |
| `src/lib/memberPhotos.test.ts`, `src/components/features/ace/FamSheet.test.tsx` | A linked person's approved `public_member_avatars` photo beats the surface's local photo; unlinked people never borrow one. ACE tree nodes show the shared avatar, are selectable by click and keyboard, and the rail offers the Leaderboard's photo request flow only for linked members; that dialog takes focus, keeps Tab inside it, and returns focus to its trigger; Escape closes only that modal. An admin rename clears the link (`isRenamed`). | **Privacy-adjacent:** one approved photo per `members.id`, shown only where the person is explicitly linked. |
| `src/lib/memberLinkMatching.test.ts`, `src/lib/aceMemberLinks.test.ts`, `src/data/repos/memberLookup.test.ts`, `src/data/repos/aceFamilies.links.test.ts`, `src/components/features/admin/AceLinkReviewPanel.test.tsx`, `src/pages/Admin/AceFamilies.links.test.tsx` | ACE → member linking matches only exact normalized full names (case, spacing, Vietnamese diacritics ignored; middle initials significant). One match is suggested; several same-name members are never auto-picked; a member already linked to another node, or uniquely matching two unlinked nodes, is flagged, not recommended. Bulk link applies only checked unique matches and only to still-unlinked rows (`.is('member_id', null)`). Admin → ACE shows each node's status, links/unlinks one node with a single-column update, blocks link changes during an unsaved rename, and a saved rename clears the link. Member search reads only `public_members` (no email). | **Integrity/privacy:** a wrong link shows one person's photo on another person, so identity is never guessed. |
| `src/components/features/ai/formatAssistantMessage.test.tsx` | Ask VSA answers render their markdown: flattened `* **Label:**` bullets become a real list with bold labels, numbered lists/headings/italic/code render, no raw `*`/`#` reaches the bubble, internal links route in-app, and only http(s) or same-site URLs become links (`javascript:` and `//host` are refused), and link URLs are `encodeURI`-escaped without double-encoding (so `/\host` stays in-app). | Real answers showed raw `**` and run-on bullets; also guards the link allowlist on model-generated text. |
| `src/components/features/auth/SignInForm.test.ts` | Admin sign-in failures give one generic message (no account enumeration via "Email not confirmed"), except rate limiting and connection errors (#235). | **Security.** |
| `src/components/features/events/EventInterestButtons.test.tsx` | The interest control resets its saved choice and counts when reused for a different event, and invalidates other cached copies (events, event detail, Home preview) after a change (#407 review). | Prevents wrong aggregate interest counts. |
| `src/components/common/ApplicationCTA.test.tsx` | Admin-authored before-open / after-close messages take precedence over page fallback copy. | Applications UX. |
| `src/components/common/EditorialHero.test.tsx` | Shared program-page hero renders a single h1 with the emphasized script word, an `aria-hidden` watermark, and the actions row only when actions are passed. | Program-page hero structure (ACE, House, Intern, VCN, WNC). |
| `src/components/layout/navigation/MobileDrawer.test.tsx`, `src/components/common/PaginationControls.test.tsx`, `src/components/ui/SplitText.test.tsx` | Drawer traps Tab and restores focus on Escape; page-size selector has an accessible name; animated split text is exposed to assistive tech (#414). | **Accessibility regressions.** |
| `src/lib/eventTime.test.ts`, `src/utils/losAngelesDate.test.ts` | Event date ranges and San Diego ↔ instant conversions, including DST days (#415). | Timezone correctness. |
| `src/data/repos/pointsSystemsBoundary.test.ts` | The public leaderboard repository never reads the check-in tables (`event_attendance`, `user_points`, `check_in_to_event`), and the check-in repository never reads leaderboard tables or views; every method is discovered by reflection and must run to completion (#310). | **Protects the dual-points-systems boundary** (see `docs/leaderboard-system.md`). |
| `src/utils/leaderboardRanking.test.ts` | Leaderboard tie-breaking: points first, then events attended; equal on both is a tie. | **Leaderboard-adjacent** (ordering only, not aggregation). |
| `src/utils/leaderboardYears.test.ts` | The public leaderboard's default year: active year with data, else most recent year with data, else active year, else newest; term/data years merge newest-first. | **Consistency:** the public page and the admin Top 3 Story resolve "current year" identically. |
| `src/lib/story/top3Story.test.ts` | Top 3 Story selection uses the public comparator (points, then events), skips zero-point members, never mutates source rows, and formats names/points/year labels/file names; House pills use the view's hex accent, then the House constant, then teal. | **Leaderboard-adjacent** (display only — no point math). |
| `src/lib/story/storyCanvas.test.ts` | Story canvas helpers: hex alpha/shade math, text fitting steps down then ellipsizes, and long names wrap into two balanced lines before ellipsizing. | **Share-graphic legibility.** |
| `src/components/features/admin/Top3StoryDialog.test.tsx` | Admin → Points Top 3 Story dialog lists the Top 3 with points, switches headline presets and dark/light looks, enables Download once rendered, and shows a disabled empty state when the year has no points. | **Admin share workflow.** |
| `src/data/wrappedEdition.test.ts` | The Wrapped nav/footer label comes from the published edition's year label, not a literal (#263). | Seasonal content. |
| `src/utils/generateSlug.test.ts`, `src/utils/hashScroll.test.ts`, `src/utils/matchCabinetRole.test.ts` | Slug generation; hash-link scrolling to late-rendered targets; cabinet role-title normalization. | Utility behaviour. |
| `src/components/features/calendar/MonthGrid.test.tsx` | Phone calendar tiles show the first event flyer on a day with that event's name and a +N badge for extra events; an event without an image (or whose image fails to load) still shows its name, and a tile reused for another event retries its image; any day, empty or not, is selectable; the month agenda lists the month's events and narrows to the selected day. | Mobile calendar readability: which event is on which day. |

**Still unprotected — where you have NO automated safety net:**

- **Points / attendance / leaderboard _calculation_** — no direct tests. `memberMatching.test.ts` covers import _matching_ and `wrapped.test.ts` covers standings _sorting_, but the canonical points math and leaderboard aggregation are exercised only by manual QA + the leaderboard checklist (section 5). This is the most protected domain in the repo (section 4).
- **Most repositories in `src/data/repos/`** — covered: events, houseEvents, ACE/program content/VCN draft guards, applicationLinks, academicTerms, houseMemberships, column allowlists, admin photo publishing. The rest (gallery, cabinet, members, points, import, AI knowledge, …) are exercised only by humans (#291).
- **Auth gating, admin gating, and most feature components** — public routes have a mount/settle smoke test (`publicRoutes.smoke.test.tsx`); admin and protected routes do not.
- **RLS policies** — deliberately not covered by Jest (client tests can't prove server policy). Covered instead by `scripts/verify-rls-security.mjs` → interpretation guide in `vsa-diagnostics-and-measurement`, runbook pointer in section 5.

Consequence: for any change in an unprotected area, Gate 4 (manual exercise) carries the entire burden. Do not skip it.

---

## 3. How to add a test

**Where it goes.** Colocate next to the source file: `src/utils/foo.ts` → `src/utils/foo.test.ts` (`.test.tsx` for component tests). CRA discovers `*.test.ts(x)` anywhere under `src/` automatically — no config change needed.

**Run just your file:**

```bash
CI=true npm test -- --watchAll=false --testPathPattern=seasonalState
```

**What's already set up for you** (`src/setupTests.ts`, loaded before every test file):

- `@testing-library/jest-dom` matchers (`toBeInTheDocument`, etc.)
- `process.env.REACT_APP_SUPABASE_URL` / `_ANON_KEY` set to test dummies — so importing `src/lib/supabase.ts` (which throws on missing env at module load) works in tests
- `window.matchMedia` mocked (jsdom lacks it; ThemeContext needs it)
- `@supabase/supabase-js` module-mocked with a chainable no-op query builder — tests never hit a real database

**Jest quirks pinned in `package.json`:**

```json
"jest": {
  "transformIgnorePatterns": [
    "node_modules/(?!(zod|@hookform/resolvers)/)"
  ]
}
```

`zod` and `@hookform/resolvers` ship ESM; without this exception Jest fails with `Unexpected token 'export'`. If a new ESM-only dependency breaks tests the same way, that pattern is where it gets added — but environment breakage diagnosis belongs to `vsa-build-and-env`.

**The pattern to copy** — pure-function domain tests, from `src/utils/seasonalState.test.ts`:

```ts
import {
  getCurrentVsaSeason,
  isSummerBreak,
  shouldUseSummerEmptyState,
} from './seasonalState';

describe('seasonal state helpers', () => {
  it('treats the day before June 15 as active year', () => {
    expect(isSummerBreak(new Date('2026-06-14T19:00:00Z'))).toBe(false);
    expect(getCurrentVsaSeason(new Date('2026-06-14T19:00:00Z'))).toBe('active_year');
  });

  it('starts summer break on June 15 in Los Angeles', () => {
    expect(isSummerBreak(new Date('2026-06-15T19:00:00Z'))).toBe(true);
  });
});
```

Notes on the pattern: plain `describe`/`it`, exact expected values (not shape assertions), each `it` name states the domain fact it pins. Prefer this style — extract logic into a pure function and test the function, rather than mounting large component trees.

**CRA/jsdom limitations — what Jest here cannot verify:**

- No real browser: no layout, no CSS, no Tailwind classes actually applied, no dark-mode rendering, no scroll/resize behavior. Visual claims need manual QA (section 7).
- No real network or database: the Supabase client is mocked, so tests cannot verify queries, RLS, or data correctness.
- Framer Motion and ThemeProvider emit known warnings under jsdom — acceptable per the rule quoted in section 1.
- CRA owns the Jest config; only the whitelisted keys (like `transformIgnorePatterns`) can be overridden in `package.json`. Do not attempt a standalone `jest.config.js` and do not `npm run eject`.
- No secrets or real member data in tests or fixtures, ever (`.claude/agents/vsa-testing-qa.md`).

---

## 4. When tests are REQUIRED vs optional

**REQUIRED — protected domains.** AGENTS.md forbids modifying attendance import, points calculation, House membership, or leaderboard calculation *unless explicitly requested*. When such a change IS explicitly requested, `.claude/agents/vsa-points-attendance-guardian.md` sets the bar:

> "Any change requires clear acceptance criteria and tests."

Concretely, before merge a protected-domain change must have: (a) written acceptance criteria (section 6) agreed *before* coding, (b) new or updated focused tests pinning the changed behavior, (c) the assigned final gates green, and (d) the relevant manual checklist run (leaderboard checklist for anything touching standings — section 5). Whether the change is permissible at all is `vsa-change-control`'s territory; this skill only defines the evidence it must carry.

**REQUIRED — domain-fact changes.** If you legitimately change House history data or seasonal boundaries, update `legacyHouseArchive.test.ts` / `seasonalState.test.ts` in the same PR with the corrected facts. A red golden test is doing its job; never delete or loosen it to get green.

**STRONGLY RECOMMENDED:** regression test for any fixed logic bug (pin the bug, per `.claude/agents/vsa-testing-qa.md`); tests for any new pure utility in `src/utils/` or `src/lib/`; tests for new data-transform logic feeding public pages.

**OPTIONAL (manual QA carries the burden instead):** styling/layout-only changes, copy changes, component rearrangements with no logic change. jsdom can't see what these change anyway — spend the effort on the section 7 runbook instead.

**Never acceptable:** weakening protected logic, deleting a golden test, or loosening an assertion to make a suite pass (`vsa-testing-qa` playbook: "Do not weaken protected logic to make a test pass").

---

## 5. Checklist routing table

Pick every row that matches your change; run all that apply.

| You changed… | Run this | Notes |
|---|---|---|
| Anything under `supabase/migrations/` touching RLS, grants, views, or RPCs | `docs/rls-verification-checklist.md` → `node scripts/verify-rls-security.mjs` | Staging first, production after. Never with a `service_role` key (bypasses RLS, invalidates every check). Mutation tests (`RLS_ALLOW_MUTATION_TESTS=true`) never on production without leadership approval. Script env/interpretation details: `vsa-diagnostics-and-measurement`. |
| Anything near points, attendance, standings, academic terms, or the leaderboard UI | `docs/leaderboard-test-checklist.md` | Covers four surfaces: public `/leaderboard` (year selector defaults to active year, All-Time matches prior standings, year switching/search/pagination), `/admin/points` (KPI cards and Top-10 follow selected year), `/admin/import` (term labels shown, no-term warning, points attributed to the event's academic year), `/admin/members` (Yearly Breakdown sums match per-year events). Run it whenever standings could shift, even from a "display-only" change. |
| Modals, drawers, toasts, calendars, or other dynamic/interactive UI | Open manual a11y items in `docs/final-compliance-reaudit.md` (§2, §7) | Still-open live checks as of that audit (2026-06-19): mobile-drawer focus trap (Tab stays inside, focus returns to menu button on close); toast announcements read by screen readers (`role="status"`/`aria-live="polite"`); color contrast ≥ 4.5:1 for secondary text in BOTH themes; full keyboard walk with visible focus on every interactive element. |
| Routes, auth, providers, or anything in `src/routes/` / `src/App.tsx` | Route QA (below) | |

**Route QA runbook:**

1. **Public loads without auth** — in a logged-out/incognito session, load `/`, `/events`, `/leaderboard`, `/cabinet`, `/gallery`. No auth prompt, no crash, no private data (check the leaderboard network payload for `auth_user_id`/emails — must be absent, per `docs/final-compliance-reaudit.md` §7).
2. **Protected redirects** — logged out, visit `/profile`, `/points`, `/feedback`: expect redirect to sign-in, not a blank page or error.
3. **Admin gated** — as a signed-in *non-admin*, visit `/admin`: expect denial/redirect, and no admin nav items visible.
4. **Degraded mode** — the app must survive Supabase being unreachable. To simulate locally: point `.env.local` at a syntactically valid but unreachable project (e.g. `REACT_APP_SUPABASE_URL=https://unreachable-degraded-test.supabase.co`, any non-empty anon key) and restart `npm start`. Fetches fail → `isSupabaseUnavailable()` (`src/utils/isSupabaseUnavailable.ts`) returns true for network errors and 429/402/503/504 → public pages must show fallback content (`src/config/publicFallbackContent.ts`) or `ContentUnavailableState`, never a white screen. **Do not test by deleting the env vars** — `src/lib/supabase.ts` throws `Missing Supabase environment variables` at boot, which tests nothing (that symptom belongs to `vsa-build-and-env`). Restore your real `.env.local` afterward.

---

## 6. Acceptance-criteria discipline

Write acceptance criteria **before coding**, as observable, testable outcomes — each one something a reviewer can check true/false without reading the diff. "Improve the events page" is not a criterion; "the calendar button stays inside its card at 375px width" is.

The repo template is `docs/claude-subagent-task-template.md` (fields include Subagent, Goal, Current problem, owned/forbidden scope, safety rules, **Acceptance criteria**, focused verification, Manual QA, and final report). Its focused-verification block assigns only the question that specialist owns. The filled example is the calibration for how specific criteria should be:

```
Goal:
  Fix the Google Calendar button overflowing on event cards on mobile.

Acceptance criteria:
  - Button stays within the card on mobile and desktop
  - No regression to other event card content

Manual QA:
  - Load /events at mobile and desktop widths; confirm button fits
```

Rules of thumb:

- 2–5 criteria. More usually means the scope is too big for one PR (AGENTS.md: small, focused PRs with explicit acceptance criteria).
- Every criterion pairs with a verification method: a command, a test, or a specific manual-QA step. If you can't say how you'd check it, rewrite it.
- Include at least one **negative** criterion (what must NOT change) whenever the change is near a protected domain — e.g. "public leaderboard standings identical before/after".
- For protected-domain changes, criteria are mandatory and precede any edit (section 4).

---

## 7. Manual QA runbooks for the riskiest recurring change types

These are the change types that historically break in ways no command catches. Run the matching runbook when that surface is part of the selected final evidence.

### A. Public content change (copy, launch content, program pages)

1. Load the changed route logged out. Confirm the new content, no placeholder text, no broken images.
2. Grep your diff for private data: no emails, check-in codes, real application URLs for closed/future windows (AGENTS.md never-do list; form-link rules live with the `vsa-applications-forms` playbook agent and the `vsa-change-control` skill).
3. Domain-fact spot check: presidents, House names, and years must match AGENTS.md "Domain-critical facts" — never invent Houses or members.
4. Degraded mode (section 5 step 4): the changed page still renders fallback content when Supabase is unreachable.
5. Both themes: toggle light/dark; new copy must use semantic tokens (no invisible gray-on-gray text in dark mode).

### B. Admin CRUD change (events, gallery, cabinet, members, applications)

1. As admin: exercise the full cycle — create, edit, verify it renders where members see it, delete/unpublish. Confirm drafts/unpublished items do NOT appear on public routes.
2. As non-admin: confirm the admin route is still gated and the new UI leaks nothing (route QA steps 1–3).
3. Check mutations flow through the repository layer (`src/data/repos/`), not raw `supabase.from(...)` in components — verification habit from `docs/rls-verification-checklist.md` §8.
4. Errors surface via toast or `PageError` — force one failure (e.g. required field empty) and confirm it's not swallowed.
5. If the change touches points/attendance/standings even indirectly, run the leaderboard checklist (section 5).

### C. Mobile UI change (the current campaign area — see `vsa-ui-excellence-campaign`)

Device-emulation matrix — all cells, in browser devtools:

| | 375px (mobile) | 768px (tablet) | Desktop |
|---|---|---|---|
| Light mode | ☐ | ☐ | ☐ |
| Dark mode | ☐ | ☐ | ☐ |

Per cell: no horizontal overflow/clipped tap targets; bottom sheets, snap rails, and the quick-nav dock still open/scroll/dismiss (these shipped recently — commits `feb4b263`, `368fbf63`, `5902bdd6` — and regress easily); fixed/sticky elements don't cover content or each other.

Then: keyboard/focus pass on any new interactive element (a11y items, section 5); degraded mode on the changed page; confirm no inline `style` props or hardcoded color classes snuck in (`npm run lint` won't catch these — grep your diff).

### D. Migration-coupled change (frontend + `supabase/migrations/` together)

1. **Order matters**: migrations are applied manually here — application procedure and ordering live in `vsa-run-and-operate`; the policy lives in `vsa-change-control`. QA the frontend against a database that already has the migration.
2. Test the *mismatch* window both ways: new frontend against old schema (pre-apply) and old frontend against new schema (post-apply, pre-deploy). Neither may hard-crash public pages — expect graceful errors or fallbacks.
3. If the migration touches RLS, grants, a view, or an RPC: RLS checklist row (section 5) is mandatory. New views have a known privilege gotcha — see `vsa-supabase-security-reference` before writing, `scripts/verify-rls-security.mjs` after applying.
4. Update `src/types/database.ts` to match the schema (AGENTS.md convention) — then re-run all of section 1's gates, since the build is what proves the types agree.
5. Verify with real (staging) data shapes, not just the mocked client — Jest cannot see schema drift (section 3 limitations).

---

## Provenance and maintenance

Sources (repo, branch `codex/reactbits-ui`, as of 2026-07-06):

- `AGENTS.md` — §Testing (acceptable-warnings rule, quoted verbatim), §PR/branch conventions (CI runs but is not a protected merge gate), §Things to never do, §Domain-critical facts.
- `package.json` — scripts and `jest.transformIgnorePatterns`.
- `src/__meta__/playbookRoster.test.ts`, `src/App.test.tsx`, `src/data/legacyHouseArchive.test.ts`, `src/utils/seasonalState.test.ts`, `src/setupTests.ts` — read in full.
- `src/lib/supabase.ts` (env throw at line 13), `src/utils/isSupabaseUnavailable.ts` (degraded-mode detection).
- `.claude/agents/vsa-testing-qa.md`, `.claude/agents/vsa-points-attendance-guardian.md` (quoted).
- `docs/rls-verification-checklist.md`, `docs/leaderboard-test-checklist.md`, `docs/final-compliance-reaudit.md` (dated 2026-06-19), `docs/claude-subagent-task-template.md` (example quoted verbatim).
- `.github/workflows/deploy.yml` — lint/test/build on `pull_request` → `main`.
- `gh api repos/{owner}/{repo}/branches/main/protection` → HTTP 404 "Branch not protected" (checked 2026-07-06).

Re-verify volatile facts:

```bash
find src -name "*.test.ts*" | sort                               # current test inventory; do not trust a fixed count
grep -n "acceptable" AGENTS.md                                    # acceptable-warnings rule unchanged?
grep -n "transformIgnorePatterns" -A 3 package.json               # jest quirk unchanged?
grep -n "pull_request\|npm run lint\|npm test\|npm run build" .github/workflows/deploy.yml
gh api repos/{owner}/{repo}/branches/main/protection              # 404 = main still unprotected
grep -n "acceptance criteria and tests" .claude/agents/vsa-points-attendance-guardian.md
ls docs/rls-verification-checklist.md docs/leaderboard-test-checklist.md docs/final-compliance-reaudit.md docs/claude-subagent-task-template.md
```
