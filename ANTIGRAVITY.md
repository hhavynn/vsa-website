# ANTIGRAVITY.md

Adapter for Google Antigravity working in the VSA at UCSD website repo. This file is intentionally thin — the rules live elsewhere and this points at them.

## Read these first
1. **Root `AGENTS.md`** — the governance contract: protected domains, the never-do list, branch/PR rules, domain-critical facts. It is authoritative.
2. **`docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md`** — the canonical, detailed orchestration workflow. Follow it for every non-trivial task and scale rigor to task risk.

## How to work here
- Treat the user's requests as messy natural-language product intent. **You supply the process; the user should not have to name Graphify, Repomix, Superpowers, Impeccable, a skill, a playbook, tests, or a risk tier.** The workflow doc tells you when each applies.
- **Skills** (`.claude/skills/<name>/SKILL.md`) are project runbooks/knowledge. Read the *owning* skill for the fact you need — never all 16. Use the skill router in the workflow doc (§4).
- **Playbooks** (`.claude/agents/<name>.md`) are source-of-truth **domain personas** — distinct from skills. Infer the matching playbook automatically. Use native delegation when available; otherwise execute bounded playbook passes sequentially while preserving separate implementation and review roles (workflow §§5 and 9). Never claim a Claude-native subagent was invoked.
- **Graphify** before broad search for structural questions: `./scripts/graphify-run query "<question>"` (also `path`, `explain`). Verify implementation-critical claims against source. Do not rebuild the graph inside a feature PR.
- **Repomix** (`npx repomix`) only after scope is narrowed — pack one coherent slice, never the whole repo.
- **Superpowers** methodology is routed proportionally in workflow §6 (the plugin is installed for Claude; Antigravity uses the encoded equivalent). Do not apply every method to every task.
- **Impeccable** for meaningful UI/UX/design work — combine it with `vsa-design-system-reference`; it never replaces the repo's design tokens or product identity.

## Non-negotiables (see `AGENTS.md` and the workflow doc for the full list)
- Classify risk before acting; high-risk (auth, RLS, migrations, points, attendance, House membership, leaderboard, applications, check-in, storage policies, private data, production) gets architecture review, privacy review, stronger validation, and adversarial review.
- Inspection is not authorization to mutate production. Migrations are applied manually. Never weaken RLS.
- Preserve pre-existing user changes and local setup files. Never commit to `main`; branch, stage exact files, push, and provide a manual PR title/body/URL (no `gh pr create` unless asked).
- Follow the verification ownership model in workflow §13; do not repeat a successful check merely because work crossed an agent boundary.
- Report exact evidence — never conflate "read a playbook" with "invoked a subagent," or "wrote a migration" with "applied one."
