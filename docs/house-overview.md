# CRC House overview (#651)

Admin → Houses → **Overview** is the private, live House scoreboard for CRC and admins. House standings are embargoed (#692): never share these numbers publicly or as an announced GBM result (#693 owns official snapshots).

## What it shows

For the year, or one term (**Period**), one card per House profile of that year (from the year's profiles, never hardcoded names), plus a comparison table:

- **Members**: everyone with a House membership overlapping the period (the term's dates, or the whole year), plus anyone credited for the House on the period's events (so participation never exceeds 100%), and how many joined after the term began. A term without dates (2023-24 and 2024-25 in production) cannot bound memberships or House events: the page says so and those cover the whole year, while credits still count only that term's events.
- **Attended at least once**: members with at least one House-credited attendance in the period, and the percentage of the House's members in that period. An empty roster shows "—", not 0%; the percentage never rounds up to 100% or down to 0% when that is not exact.
- **House-credited attendance**: credits counted for the House in the period. They use exactly the attribution of `house_yearly_points` (active profile, effective membership by the event's date, positive points, the 2025-26 cutoff), so attendance before a member's House start date never counts. For the whole year the function checks that these equal the view's totals; a mismatch is flagged.
- **Rank and year points**: read from `house_yearly_points` itself (ties share a rank; no winner from a tie).
- **House Parents linked / listed**, **House events hosted** (a collab counts for each host; the distinct total across Houses is shown below the table). Attendance at House events is not tracked and earns no points.
- **Needs attention**: members with no credited attendance in the period, a profile that is not public yet, unlisted or unlinked House Parents, members in two Houses at once, and credits that disagree with the view.

A banner uses the Attendance status read (#653) to say whether past point-earning events are still waiting on an import or review, because then the numbers may be low.


**Forward-only data-integrity correction:** The original migration `20261028075724` is preserved unchanged because its application status must be treated as potentially applied. Migration `20261028200000_admin_house_overview_weighted_reconciliation.sql` replaces the same admin-only function so whole-year reconciliation compares the **sum of `points_earned`**, not the number of attendance rows. Both migrations are exercised by `scripts/test-house-overview.sh` using a synthetic two-point attendance record. The new migration has **not** been applied or verified on a hosted database in this review; run the disposable PostgreSQL fixture and staged role/POST checks before production rollout.

## Data and safety

`admin_house_overview(p_year, p_term_id)` (migration `20261028075724`, applied to production 2026-10-28; written as `20261028100000` and renamed to its recorded version): admin-only, SECURITY DEFINER (the score views are private to the API since #692), POST-only like `admin_private_house_standings`, STABLE, pinned `search_path`; counts and House names only, no member names or rows. Proof: `bash scripts/test-house-overview.sh` (mid-quarter join, transfer, inactive profile, collab counted once globally, drafts excluded, term window, tie ranks, totals equal the view).

Drilldown into one House's members is #652; a House Parent view is #654.
