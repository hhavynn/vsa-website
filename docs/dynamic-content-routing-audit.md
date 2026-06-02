# Dynamic Content Routing Audit

Last updated: 2026-06-02

This checklist documents the public/admin content relationships for the VSA at UCSD site. Use it before changing routes that read Supabase data, Supabase Storage URLs, static archive data, or admin-managed content.

## Public/Admin Route Map

| Route | Public/Admin | Primary content source | Admin editor | Notes |
| --- | --- | --- | --- | --- |
| `/` | Public | `homepage_content`, program content, published events, gallery/recap data, site settings | `/admin/content`, `/admin/events`, `/admin/gallery`, `/admin/settings` | Missing homepage content falls back to safe default copy. Published event filtering is required. |
| `/events` | Public | `events`, `event_recaps`, `gallery_events` | `/admin/events`, `/admin/gallery` | Public event list must only show `events.is_published = true`. |
| `/leaderboard` | Public | member points views, House points views, official public House override utility | `/admin/points`, `/admin/import`, `/admin/events`, `/admin/houses` | Do not change point calculations or House membership event-date logic here. |
| `/house` | Public | published `house_page_assets`, House events, House points views, current-year static fallback only | `/admin/houses` | Current 2025-2026 may use fallback assets only when DB assets are missing. Archive years must not fall back to current Houses. |
| `/house/:houseSlug` | Public | published current-year `house_page_assets`, House events, House points views | `/admin/houses` | Invalid House slugs show a friendly not-found. |
| `/house/year/:yearSlug` | Public | published `house_page_assets` scoped by year, legacy archive static data where applicable | `/admin/houses` | Invalid year slugs show a friendly not-found. Future years show placeholder copy. |
| `/house/year/:yearSlug/:houseSlug` | Public | published `house_page_assets` scoped by year, House events scoped by profile/year | `/admin/houses` | Invalid year or House slugs show a friendly not-found. |
| `/house/archive` | Public | verified static legacy year list and DB-backed published House assets | `/admin/houses` | Archive overview should not invent years. |
| `/gallery` | Public | `gallery_events`, linked event recap data | `/admin/gallery`, `/admin/events` | Albums need public Google Photos URLs. Missing cover images use public fallback UI. |
| `/cabinet` | Public | `cabinet_members`, `cabinet_years` | `/admin/cabinet`, `/admin/years` | Current page uses active cabinet year. Archive years must not mix with current. |
| `/get-involved` | Public | program content plus static route cards | `/admin/content` | Program status/link rows are the editable source of truth. |
| `/uvsa-network` | Public | `uvsa_schools`, `external_events` | `/admin/uvsa-schools`, `/admin/external-events` | Public external events should exclude drafts. |
| `/vcn/current` | Public | current published `vcn_archives` row | `/admin/vcn` | Missing current row shows coming-soon state, not hardcoded production content. |
| `/vcn/archive` | Public | published `vcn_archives` rows | `/admin/vcn` | Drafts stay admin-only. |
| `/wild-n-culture` | Public | program content and static page framing | `/admin/content` | Program status/link rows are editable. |
| `/points` | Public/auth | member points lookup and check-in code flow | `/admin/events`, `/admin/import`, `/admin/points` | Draft event codes should not be usable for public check-in. |
| `/feedback` | Public | `feedback` inserts | `/admin/feedback` | Do not expose admin notes publicly. |
| `/admin` | Admin | dashboard counts and diagnostics | n/a | Should explain "what can I edit?" by topic. |
| `/admin/events` | Admin | `events`, storage `event_images`, `event_recaps`, `academic_terms` | n/a | Admin reads all events, including drafts. |
| `/admin/houses` | Admin | `house_memberships`, `house_page_assets`, `house_events`, storage `house_images` | n/a | Keep assignment imports separate from profiles/images/events. |
| `/admin/cabinet` | Admin | `cabinet_members`, `cabinet_years`, storage `cabinet_images` | n/a | Selected cabinet year must be obvious. |
| `/admin/gallery` | Admin | `gallery_events`, storage `gallery_images`, linked `events` | n/a | Google Photos URL is required for public albums. |
| `/admin/content` | Admin | `homepage_content`, program content | n/a | Affects homepage plus program pages. |
| `/admin/settings` | Admin | `site_settings`, storage `site_assets` | n/a | Affects global logo/branding. |
| `/admin/vcn` | Admin | `vcn_archives` | n/a | Current + published flags drive public VCN routes. |
| `/admin/years` | Admin | `academic_terms`, `cabinet_years` | n/a | Shared by events, cabinet archive, and point filters. |

## Dynamic Content Source Map

| Content type | DB/storage/static source | Public consumers | Admin editors | Pitfalls |
| --- | --- | --- | --- | --- |
| Events | `events`, storage `event_images`, `event_recaps` | `/events`, `/`, Ask VSA, `/points` check-in | `/admin/events` | Public consumers must filter `is_published = true`; Admin must read drafts too. |
| House profiles/assets | `house_page_assets`, storage `house_images`, static current fallback | `/house`, House detail routes, `/leaderboard` cards | `/admin/houses` Profiles & Images | Static fallback is current-year only. Archive years must stay year-scoped. |
| House years/archive years | `academic_terms`, verified legacy static archive | `/house/archive`, `/house/year/:yearSlug` | `/admin/houses`, `/admin/years` | Invalid slugs must not resolve to current year. |
| House events | `house_events`, `house_event_houses`, storage `house_images` | House overview/detail routes | `/admin/houses` House Events | Draft events stay admin-only. Collab events must remain linked to all host Houses. |
| House parents | `house_page_assets.house_parent_*` | House detail pages | `/admin/houses` Profiles & Images | Empty parent fields should show public coming-soon copy. |
| Cabinet | `cabinet_members`, `cabinet_years`, storage `cabinet_images` | `/cabinet` | `/admin/cabinet`, `/admin/years` | Null-year members are treated as active-year records by existing behavior. |
| Gallery/recaps | `gallery_events`, `event_recaps`, storage `gallery_images` | `/gallery`, `/events`, `/` latest memory | `/admin/gallery`, `/admin/events` | A recap tied to a draft event should not surface the event publicly. |
| Homepage content | `homepage_content`, program content, site settings | `/` | `/admin/content`, `/admin/settings` | Defaults are safe fallback copy, not the source of truth. |
| Site settings/logo/theme | `site_settings`, storage `site_assets` | global layout and header/footer | `/admin/settings` | Preserve existing logo URL unless a new image is saved or cleared intentionally. |
| Leaderboard/points | points views, attendance tables, event point rows | `/leaderboard`, `/points`, member dashboard | `/admin/import`, `/admin/points`, `/admin/events` | Do not change attendance imports, point calculations, or House membership date logic without a separate audit. |
| UVSA/external network | `uvsa_schools`, `external_events` | `/uvsa-network` | `/admin/uvsa-schools`, `/admin/external-events` | Draft external events should stay private. |
| VCN/WNC | `vcn_archives`, program content | `/vcn/current`, `/vcn/archive`, `/wild-n-culture` | `/admin/vcn`, `/admin/content` | Missing current VCN row should show coming-soon, not stale hardcoded copy. |
| Ask VSA AI assistant | `ai_knowledge_snippets`, public event preview context | Ask VSA widget/function | no full admin editor; resources index documents operations | Do not expose private member data, check-in codes, admin notes, or draft events in assistant context. |

## Common Pitfalls

- Public pages that "look fine" because they use static fallback data can hide missing DB rows from Admin.
- Admin pages often need to read draft/unpublished rows; public pages almost never should.
- Current-year House fallback data must not appear on archive year routes.
- Invalid `yearSlug` values must not fall back to the current year.
- Missing Supabase Storage images should render public fallback UI, not broken image icons.
- Archive cabinet years, House years, and VCN years must stay scoped to their selected year.
- Any code that queries `events` directly should be reviewed for `is_published` handling.
- Any change to points, attendance, or House membership timing needs a separate focused review.

## QA Checklist

Public routes:

- `/` loads, homepage content appears, event preview excludes drafts, no private/admin copy.
- `/events` loads published events only; missing images do not break cards.
- `/leaderboard` loads member and House standings; public House overrides still show Bowser 247, Donkey Kong 215, Toad 158, Boo 125 for 2025-2026 when active.
- `/house` loads current 2025-2026 data and does not mix archive data.
- `/house/bowser` loads the current Bowser page or a friendly not-found if not configured.
- `/house/year/2024-2025` shows Sanrio archive data only.
- `/house/year/2024-2025/kuromi` shows the Sanrio Kuromi page or a friendly not-found if unpublished.
- `/house/year/2023-2024` shows drink House archive data only.
- `/house/year/2026-2027` shows future-year placeholder content only.
- `/gallery` loads public albums and cover fallbacks.
- `/cabinet` loads active cabinet year without mixing archives.
- `/uvsa-network` loads school cards and non-draft external events.
- `/get-involved` loads program content and safe fallbacks.
- `/vcn/current` shows the current published archive row or coming-soon placeholder.

Admin routes:

- `/admin` answers "what can I edit?" and each card states public pages affected.
- `/admin/events` reads all events, shows Draft/Published status, and can save visibility.
- `/admin/houses` makes selected year obvious and separates assignments, profiles/images/parents, House events, and legacy backfill.
- Admin Houses Profiles & Images shows an actionable empty state for the selected year.
- Admin Houses House Events shows drafts and published rows, with clear public visibility language.
- `/admin/cabinet` makes selected cabinet year obvious and archive-safe.
- `/admin/gallery` explains Google Photos links, covers, and public Gallery impact.
- `/admin/content` explains homepage versus program content.
- `/admin/settings` explains global branding impact.
- `/admin/vcn` explains current and published flags.

## What Not To Touch Without Separate Approval

- Do not run `git reset --hard` or `git clean -fd`.
- Do not touch `.claude/` or `supabase/.temp/cli-latest`.
- Do not delete database rows.
- Do not delete Supabase Storage files.
- Do not modify attendance import logic.
- Do not modify individual leaderboard point logic.
- Do not modify House point calculation logic.
- Do not modify House membership event-date logic.
- Do not weaken RLS broadly.
- Do not expose private member data, emails, check-in codes, payment logs, import notes, or admin notes publicly.
- Do not create fake events, fake points, fake members, fake standings, or fake House assignments.
- Do not rewrite the whole app in one pass or add heavy dependencies for routing/content fixes.
