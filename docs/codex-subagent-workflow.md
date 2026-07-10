# Codex VSA Playbook Workflow

Codex inherits root `AGENTS.md` and the canonical `docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md`. A user describes the product outcome in ordinary language; Codex—not the user—selects the owning VSA skills, domain playbooks, tools, verification, and delegation strategy.

## Automatic routing

1. Translate the request into the canonical engineering brief and classify risk.
2. Select the owning `.claude/skills/<name>/SKILL.md` runbook and matching `.claude/agents/<name>.md` playbook from repository evidence.
3. Delegate only when bounded specialization, safety, independent review, or genuinely parallel non-overlapping work materially helps.
4. Keep one parent responsible for ownership boundaries, integration, final verification, and delivery.

The canonical roster is `.claude/agents/README.md`. Users do not need to know or name roster entries.

## Native delegation and fallback

When Codex has native subagents, dispatch bounded specialists using the context contract in canonical workflow §9. Parallelize independent read-only work or non-overlapping isolated writes only. Never allow two agents to edit the same files concurrently.

When native subagents are unavailable, execute the same playbooks sequentially as isolated specialist passes. Preserve concern boundaries and separate implementation from review; do not claim that reading a playbook was a concurrently running agent. Lack of native delegation never waives architecture, privacy, security, or protected-domain review.

## Proportionality

Delegation is normally useful for cross-cutting architecture, protected points/attendance/House/member work, RLS or privacy review, and independent final review. It is normally unnecessary for a typo, one-line configuration correction, known single-component bug, or one coherent subsystem change.

Decompose by independently reviewable concern and ownership boundary—not by file count, UI step, or test step. The parent waits for relevant specialists, reconciles disagreements against source evidence, and integrates the result.

## Audit-first domains

- `vsa-architecture-guardian` and `vsa-points-attendance-guardian` are read-only.
- `vsa-storage-egress` starts with a dry run and review-only SQL/planning.
- Points, attendance, House membership, leaderboard calculation, RLS, storage migration, and private data remain governed by `vsa-change-control`; delegation does not authorize mutation.

Use `docs/codex-subagent-task-template.md` internally when a specialist pass is justified. Verification ownership comes from canonical workflow §13 and `vsa-validation-and-qa`, not from repeating the full suite at every boundary.
