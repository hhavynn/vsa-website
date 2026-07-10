# VSA Claude Project Subagents

Project-level domain playbooks for the VSA at UCSD website. The parent agent selects the relevant playbook automatically from the user's natural-language request; users do not need to know this roster. Claude Code may invoke these natively, while other harnesses apply them through their own delegation mechanics or sequential specialist passes.

| Subagent | Mode | One-line use case |
| --- | --- | --- |
| `vsa-architecture-guardian` | Audit/review-only | Cross-cutting architecture, route/data-flow safety, PR risk analysis. |
| `vsa-public-content` | Edit-capable | Homepage, program pages, public copy, fallback/degraded content. |
| `vsa-admin-workflows` | Edit-capable | Admin dashboard, navigation, CRUD flows, admin UX. |
| `vsa-events-gallery` | Edit-capable | Events, recaps, gallery, calendar buttons, publish behavior. |
| `vsa-points-attendance-guardian` | Audit-first/read-only | Attendance import, points, leaderboard, merge/lookup behavior. |
| `vsa-house-system` | Edit-capable | House pages, year/archive routing, profiles, standings display. |
| `vsa-cabinet-leadership` | Edit-capable | Cabinet page/archive/admin, president & current-year content. |
| `vsa-ai-knowledge` | Edit-capable | Ask VSA assistant, AI knowledge base, Edge Function safety. |
| `vsa-applications-forms` | Edit-capable | Admin-managed application windows and form links. |
| `vsa-storage-egress` | Edit-capable (dry-run/docs) | Storage URL audits, egress reduction, migration planning. |
| `vsa-testing-qa` | Edit-capable | Build/lint/test failures, route QA, regression tests. |
| `vsa-docs-acceptance` | Edit-capable (docs only) | Runbooks, QA/PR checklists, scoped task prompts. |

**Audit-first / read-only:** `vsa-architecture-guardian`, `vsa-points-attendance-guardian`.

See `docs/claude-subagent-workflow.md` for usage guidance and `docs/claude-subagent-task-template.md` for the parent agent's internal specialist contract.
