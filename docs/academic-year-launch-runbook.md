# Academic-year launch runbook

Companion to [Admin → Launch Checklist](/admin/launch-checklist) and
[seasonal operations](../.claude/skills/vsa-seasonal-operations/SKILL.md).
For the incoming cabinet: this is a **manual runbook**, not a command that
changes VSA data. Dates and House content must come from actual leadership
announcements. The admin checklist currently reads live aggregate data but
**does not persist per-person completion, owner or notes**. Keep a shared
copy of the signoff table below in your approved team workspace instead.
Do not paste private cabinet/member records into a public GitHub issue.

## Before starting: safety and ownership

1. Choose an overall launch owner, a website/admin owner, a content editor,
   and one independent reviewer. Put a specific person next to every manual
   line below; do not assume a green automated badge means approval.
2. Confirm the proposed academic year and campus calendar. Never simply copy
   last year's dates, application URLs, House assignments, archive points or
   published Wrapped edition.
3. Check the **freeze windows** in `vsa-seasonal-operations`. If an application
   window is open or opening in approximately two weeks, or the VCN seasonal
   freeze applies, **do not edit that affected surface** without owner
   approval. House visual polish is exempt, but House data and reveal gating
   are not.
4. Rehearse first on a **non-production preview/branch Supabase project**.
   Validate its identity/environment before entering any data. If the staging
   backend is not ready, mark the rehearsal **blocked** rather than using prod.
5. Capture a before-state snapshot of historical **counts and public labels**
   (prior-year leaderboard, previous Cabinet, House archives, past event pages).
   Never export or attach private attendee data to public artifacts.

## Step-by-step rehearsal order

| Stage | Admin link | What the owner must confirm |
| --- | --- | --- |
| 1. Term / year | [Years & Terms](/admin/years) | New academic term exists and is active **in staging**; prior term retained; labels and start/end dates match campus year |
| 2. Current Cabinet | [Cabinet](/admin/cabinet) / [Rollover](/admin/cabinet/rollover) | New year is current only after intended transition, real roles/portraits approved; old year remains navigable |
| 3. House data | [Houses](/admin/houses) | Year mapping and approved themes are correct; no private assignments or placeholder names published early; previous House records and standings untouched |
| 4. ACE families | [ACE](/admin/ace) | New-cycle content follows consent/publication rules; ACE mentorship is separate from the House competition |
| 5. Applications | [Application Windows](/admin/applications) | Review ACE, House Fall/Winter/Spring, Intern, Cabinet, VCN Stage Ninja, VCN Props, WNC form; set times in **America/Los_Angeles**; use 11:59 PM close unless explicitly changed; only open-window URLs appear publicly |
| 6. Homepage / site copy | [Content](/admin/content) / [Settings](/admin/settings) | Homepage and program descriptions, site/year copy, navbar/footer links and social links are current; preserve the last published Wrapped edition until a new one is actually published |
| 7. Upcoming events | [Events](/admin/events) | Published list has correct date, location and links; drafts and private check-in codes are not public; new events are not fabricated to make a checklist green |
| 8. Gallery and archives | [Gallery](/admin/gallery) / [VCN](/admin/vcn) | Curated/consented images, existing albums and published show archives remain readable; unreleased VCN details stay private |
| 9. Ask VSA | [AI Knowledge](/admin/ai-knowledge?filter=review) | New-year terms, programs and application answers reviewed; expired snippets retired, no unsupported dates or private application link leaks |
| 10. Public-safe fallbacks | [Content Health](/admin/content-health) | Degraded mode works without claiming historical House points are live; review broken images, old copy and previous-year fallbacks |
| 11. End-to-end QA | [Launch Checklist](/admin/launch-checklist) | Check homepage, events, points, leaderboard, House, ACE, Cabinet, Gallery, Get Involved at 320px and desktop, in light/dark mode; basic keyboard and screen-reader pass |
| 12. Historical invariants | [Leaderboard](/leaderboard) / [Cabinet](/cabinet) / [House](/house) | Compare the **prior academic year** to the before-state snapshot: totals, archive routes, historical roster and verified House years must be unchanged |

## Deployment order and release gate

- **Rehearsal only**: complete all steps on staging with synthetic/test records.
  No production database mutations are authorized by this runbook.
- If an approved change requires SQL: apply **reviewed migrations manually**
  to the correct environment first; verify RLS, view grants and expected
  read/write behavior. Do not let a frontend deploy assume unapplied SQL.
- Then deploy the reviewed frontend and, when necessary, separately deploy
  changed Edge Functions. Check monitoring, public views, and application
  masking before considering the release complete.
- Run the public smoke checklist again after deployment, especially in
  the current application/House/VCN freeze windows.
- If a check fails, stop or roll back the affected frontend/config change per
  the incident plan. **Do not rewrite earlier leaderboard points or delete
  House/ACE history** to make an automated check green.

## Signoff evidence template

Copy this into your approved internal cabinet workspace and fill one row for
each stage. The repository deliberately does not store sensitive approvals.

| Stage | Named owner | Status (Not started / Blocked / Ready / Needs fix) | Notes and evidence link | Independent reviewer |
| --- | --- | --- | --- | --- |
| Term / year | TBD | Not started | No staging evidence yet | TBD |
| Current Cabinet | TBD | Not started | | TBD |
| Houses and ACE | TBD | Not started | | TBD |
| Applications | TBD | Not started | | TBD |
| Homepage, programs, Wrapped | TBD | Not started | | TBD |
| Events, Gallery, VCN | TBD | Not started | | TBD |
| Ask VSA and fallback content | TBD | Not started | | TBD |
| End-to-end QA | TBD | Not started | | TBD |
| Historical invariant comparison | TBD | Not started | | TBD |

**Completion rule:** an item is Ready only with a named owner, real verification
and reviewer acknowledgement. A server count on the admin page is evidence
of a read, **not** proof that the public wording, identity matches or privacy
boundary is correct.

## Still required to fully close issue #271

- Persist owner, status, notes and a tamper-aware history for each checklist
  item in a reviewed admin-only data model with explicit RLS.
- Link every remaining manual check to its execution screen.
- Conduct and record an actual pre-September staging rehearsal. No such
  rehearsal has been performed as part of this documentation change.
- Fold the rehearsal's findings back into this runbook and the admin screen.

Related: `docs/rls-verification-checklist.md`,
`docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md`.
