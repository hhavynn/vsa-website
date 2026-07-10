# GEMINI.md

Adapter for Gemini CLI working in the VSA at UCSD website repo. This file is intentionally thin — the rules live elsewhere and this points at them. Do not restate the governance contract or the workflow here; keep this to Gemini-specific mechanics.

## Read these first
1. **Root `AGENTS.md`** — the governance contract: protected domains, the never-do list, branch/PR rules, domain-critical facts. It is authoritative.
2. **`docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md`** — the canonical, detailed orchestration workflow (risk classification → owning skill(s) + playbook(s) → Graphify → Repomix → source → validate → adversarial review → exact-evidence report). Follow it for every non-trivial task and scale rigor to task risk.

The Gemini-specific lifecycle (Research → Strategy → Execution) is documented in `docs/gemini-cli-workflow.md`.

## How to work here
- Treat the user's requests as messy natural-language product intent. **You supply the process; the user should not have to name Graphify, Repomix, Superpowers, Impeccable, a skill, a playbook, tests, or a risk tier.** The workflow doc tells you when each applies.
- **Skills** (`.claude/skills/<name>/SKILL.md`) are project runbooks/knowledge. Gemini does **not** auto-load them — open the *owning* `SKILL.md` for the fact you need and read it directly (skill router in the workflow doc §4). Never read all 16.
- **Playbooks** (`.claude/agents/<name>.md`) are source-of-truth **domain personas** — distinct from skills. Read the matching playbook and apply it using Gemini's own mechanics. **Never claim a Claude-native subagent was invoked** — you are reading the file as a playbook, not running a Claude subagent. The canonical roster (with edit/audit modes) is `.claude/agents/README.md`; do not maintain a second copy here.
- **Graphify** before broad/architectural search (`./scripts/graphify-run query "<question>"`, also `path`, `explain`); verify implementation-critical claims against source. Targeted reads of known files do not need Graphify. **Do not run `graphify update .` as part of a feature change** — graph refreshes are interactive-only and go in a separate `chore: update graphify graph` commit, never mixed into a feature PR (per `AGENTS.md`).
- **Repomix** (`npx repomix`) only after scope is narrowed — pack one coherent slice, never the whole repo. It is conditional on context size, not a required step.
- **Superpowers** methodology is summarized in the workflow doc §6. Use it for meaningful work; skip the ceremony for tiny tasks.
- **Impeccable** for meaningful UI/UX/design work — combine it with `vsa-design-system-reference`; it never replaces the repo's design tokens or product identity.

## Non-negotiables (see `AGENTS.md` and the workflow doc for the full list)
- Classify risk before acting; high-risk (auth, RLS, migrations, points, attendance, House membership, leaderboard, applications, check-in, storage policies, private data, production) gets architecture review, privacy review, stronger validation, and adversarial review.
- Inspection is not authorization to mutate production. Migrations are applied manually. Never weaken RLS.
- Preserve pre-existing user changes and local setup files. Never commit to `main`; branch, stage exact files, push, and provide a manual PR title/body/URL (do not run `gh pr create` unless the user or the governing task explicitly asks for a PR).
- Verification evidence is defined once, canonically, in `.claude/skills/vsa-validation-and-qa/SKILL.md` (§1 evidence bar + acceptable-warnings rule). Run it and report exact results; do not maintain a separate command list here.
- Report exact evidence — never conflate "read a playbook" with "invoked a subagent," or "wrote a migration" with "applied one."
