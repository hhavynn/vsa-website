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

## Data and safety

`admin_house_overview(p_year, p_term_id)` (migration `20261028075724`, applied to production 2026-10-28; written as `20261028100000` and renamed to its recorded version): admin-only, SECURITY DEFINER (the score views are private to the API since #692), POST-only like `admin_private_house_standings`, STABLE, pinned `search_path`; counts and House names only, no member names or rows. Proof: `bash scripts/test-house-overview.sh` (mid-quarter join, transfer, inactive profile, collab counted once globally, drafts excluded, term window, tie ranks, totals equal the view).

## House roster (#652)

**Open roster** on a House card shows that House's members for the period (`?house=<profile id>` in the URL: an id, never a name). Private and admin-only; names only, no contact details.

- Per member: House-credited attendance in the period (only events after their House start date, by the same attribution as the standings), all VSA events attended separately, the last credited date, their dates in this House, whether they joined during the term, and whether they are also in another House this year (a transfer, or an overlap to fix).
- Dates come from the member's memberships in this House that overlap the period, so someone who left and came back shows the stint in the period (and "separate stints" when there are several). If the House's profile is not public yet, the roster says so: nobody is House-credited, so its zeros do not mean absence.
- The "VSA events" count and the drilldown use the same events: the period's termed events, plus, for the whole year, dated events with no term in July-to-July. An event with neither a date nor a term cannot be placed in a year and appears in neither.
- **Events** opens one member's year: every event attended and whether it counted for a House, or why not (before their House start, not in a House that day, profile not public, no points, no term, no date, before the 2025-26 House points start). Crediting uses the event's UTC calendar date, like the standings; when that differs from the Los Angeles date it is shown ("counted as Oct 16, by UTC date").
- Filters: everyone, attended at least once, no House-credited attendance yet, joined this period, in another House too; plus a name search.
- **Invitation list**: tick members leadership may invite to an upcoming House event and copy their names. It lives only in your browser tab, resets when you open another House or period, and is never saved; if copying is blocked the names are shown to select. Counts are not a measure of anyone's commitment.
- Corrections happen in Members, Import and House Assignments, never here.

`admin_house_roster(p_house_profile_id, p_term_id)` and `admin_house_member_attendance(p_member_id, p_year)` (migration `20261028075801`, applied to production 2026-10-28; written as `20261028110000` and renamed to its recorded version): admin-only, SECURITY DEFINER, POST-only, one jsonb array (no 1,000-row cap). Anyone credited for the House in the period is on its roster; an undated term is flagged. Proof: `bash scripts/test-house-roster.sh`.

**Forward-only overlapping-membership correction (#652):** The recorded `20261028075801` migration may already be applied, so its original SQL remains unchanged. `20261028210000_admin_house_member_attendance_overlap.sql` replaces only the admin-only attendance drilldown. When multiple active House memberships cover an event, it returns `overlapping_houses` with all active House names and no misleading single House id; the CRC can investigate the double-credit. The disposable PostgreSQL fixture exercises both migrations and a synthetic overlap. Hosted staging role/POST and result-shape verification are **not yet performed**, and no production SQL was run here.

A House Parent view is #654.
