# ACE family-tree verification — issue #675

This checklist tracks browser, assistive-technology, and rollout evidence. It does not certify a passing device or a deployed migration. Screenshots and issue/PR attachments must show fictional fixture members only. Never attach production names, IDs, photos, spreadsheet rows, private application data, or contact details.

## Automated real-DOM regression

On the exact branch SHA under review run:

    CI=true npm test -- --watchAll=false --testPathPattern='FamSheet.quality|FamSheet|FamilyTree|aceTreeLayout|FamTabs'

The FamSheet.quality.test.tsx suite exercises actual React DOM/SVG rather than mocking layoutTree: HTML year-label centers align with SVG guides; a deep-linked node stays selected across zoom/pan; a cyclic family remains navigable; and jest-axe evaluates rendered year and all-unknown layouts.

**Limit:** jsdom cannot determine actual bounding-box overlap, touch behavior, pinch coordinates, browser text sizing, VoiceOver, or TalkBack. These tests do not replace device evidence.

## Browser/device evidence matrix — not yet run

| Case | Device or viewport | Verification | Result |
| --- | --- | --- | --- |
| Narrow phone | 320 CSS px, light/dark | Year rail stays clear of nodes at 50/100/200% zoom | NOT RUN |
| Tablet | 768 CSS px, light/dark | Pan, wheel zoom, reset, modal reopen | NOT RUN |
| Desktop | 1440 CSS px, light/dark | Deep link, lineage spotlight, year gaps, Unknown band | NOT RUN |
| iPhone Safari | Physical device | Pinch, two-finger pan, rotate, VoiceOver labels | NOT RUN |
| Android Chrome | Physical device | Pinch, two-finger pan, rotate, TalkBack labels | NOT RUN |
| Reduced motion | 320/1440 CSS px | Focus, sheet reopen, no invisible controls | NOT RUN |
| Malformed synthetic fam | Phone and desktop | Cycle/missing parent never deadlocks or leaks drafts | NOT RUN |
| Archived synthetic fam | Phone and desktop | Graveyard family renders without fabricated dates | NOT RUN |

Record date, commit SHA, browser version, tested route, result (PASS/FAIL/BLOCKED), synthetic fixture name, and attachment link. Capture screenshots outside this repository. Report failures as failures and fix them without lowering thresholds.

## Database and rollout preflight — owner verification pending

- [ ] Verify approved #669 schema/view plus actual applied #673 and #674 migrations in dependency order. A merged PR or green frontend CI does not prove a migration ran.
- [ ] Verify anonymous public views expose published nodes and approved year fields only, not draft/evidence details.
- [ ] Compare aggregate published-node and verified/unknown-year counts, including Graveyard, before and after changes. Do not publish row-level private data.
- [ ] Verify later-page query failures cannot appear as an empty family.
- [ ] Verify future seasonal publish writes the Little's approved term/year while leaving the Big untouched, once #674 is approved.
- [ ] Run before/after fingerprints of family/parent/member/photo/publication fields before any #670 historical backfill.
- [ ] Record the human ACE reviewer for historical corrections; unreviewed values stay Unknown.
- [ ] Attach synthetic screenshots and actual device results to #675 before closing it.

This checklist authorizes no House Reveal, production SQL, migration application, or historical backfill.
