# VSA Skill Library — build tracker

Branch: `feat/vsa-skills-library`. One commit per skill, pushed immediately after each lands.
Authoring brief (Phase 1 discovery + owner interview 2026-07-05) lives in the build session's scratchpad; durable facts are embedded in the skills themselves.

## Status (updated 2026-07-07) — all 16 authored, committed, pushed

| # | Skill | Status |
|---|-------|--------|
| 1 | vsa-change-control | DONE (188L) |
| 2 | vsa-debugging-playbook | DONE (142L) |
| 3 | vsa-failure-archaeology | DONE (247L) |
| 4 | vsa-architecture-contract | DONE (132L) |
| 5 | vsa-supabase-security-reference | DONE (299L) |
| 6 | vsa-design-system-reference | DONE (205L) |
| 7 | vsa-config-and-flags | DONE (204L) |
| 8 | vsa-build-and-env | DONE (232L) |
| 9 | vsa-run-and-operate | DONE (201L) |
| 10 | vsa-diagnostics-and-measurement | DONE (308L) +scripts/ (2 helpers, verified runnable) |
| 11 | vsa-validation-and-qa | DONE (278L) |
| 12 | vsa-docs-and-writing | DONE (294L) |
| 13 | vsa-seasonal-operations | DONE (176L) |
| 14 | vsa-ui-excellence-campaign | DONE (282L) |
| 15 | vsa-research-frontier | DONE (455L) — recovered from `<!-- FILL -->` truncation |
| 16 | vsa-research-methodology | DONE (327L) |

## Remaining pipeline

1. ~~Author all 16 skills~~ DONE 2026-07-07 — every file has frontmatter + body + Provenance, zero placeholders.
2. Phase 3 review: three parallel reviewers (factual / doctrine / usability) — DONE 2026-07-07. Verdict: 1 blocking, 5 important, 4 minor; zero AGENTS.md/doctrine violations; zero invented citations (~90+ SHAs, all migrations, branch-protection 404, both scripts verified).
3. Fixer pass — DONE 2026-07-07. Applied:
   - BLOCKING: rewrote vsa-validation-and-qa §2 test inventory (3→10 files, accurate per-file coverage + revised unprotected-areas analysis).
   - IMPORTANT: corrected stale "3 test files" in vsa-build-and-env + vsa-seasonal-operations; added D8 drift row + §3 note in vsa-docs-and-writing (AGENTS.md list still says 3); bulleted the Ask VSA privacy prose-wall in vsa-supabase-security-reference; disambiguated bare playbook-agent refs in vsa-debugging-playbook.
   - MINOR: fixed docs-and-writing stale self-provenance; added protected-tier note to diagnostics route helper; standardized the two research-skill frontmatters to single-line plain description.
4. Final report to owner: inventory, spot-checks, remaining uncertainties.
