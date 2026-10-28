# Harness governance parity

This document records the deliberately small **shared contract** across Codex, Claude Code, Gemini CLI and Antigravity. It does **not** repeat the rules. Authority and change control remain in root [`AGENTS.md`](../../AGENTS.md), with the detailed procedure in [the canonical workflow](./AGENTIC-ENGINEERING-WORKFLOW.md).

| Fact | Canonical owner | What each adapter does |
| --- | --- | --- |
| Protected domains, permission gates, production safety, never-do list, freeze windows, branch/PR policy | `AGENTS.md` + owning `vsa-change-control` / seasonal reference | Refer to the governing sources; **do not duplicate a policy section** |
| Risk classification, review and validation workflow | `docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md` | Point to the same workflow; explain only how the harness follows it |
| Domain playbook roster | `.claude/agents/README.md`, tested by `playbookRoster.test.ts` | Consume the registry; never copy a second roster |
| QA/test inventory | `.claude/skills/vsa-validation-and-qa/SKILL.md` | Refer to the inventory, rather than maintaining per-adapter test lists |
| Provider nesting, live route set and route access classification | `src/App.tsx` and `src/routes/index.tsx` | **Re-derive from source; do not trust cached lists in an adapter** |
| Database tables/permissions | `supabase/migrations/` + source-specific security documentation | Re-derive from schema and production verification; a short table list is not authoritative |

## Legitimate harness differences

Claude Code loads project skills and invokes `.claude/agents/` subagents natively. Gemini CLI and Antigravity read owning project skills/playbooks and use their own delegation mechanics. Codex inherits `AGENTS.md` and reads the relevant domain playbook. Slash commands and nested `.claude/CLAUDE.md` are Claude-only wiring; **they never override root governance**. The test intentionally does not demand identical tool commands or implementation steps across harnesses.

## CI guard and known limits

`src/__meta__/harnessGovernanceParity.test.ts` checks that each adapter points to the authoritative sources, does not introduce duplicate protected-domain, freeze-window or never-do **headings**, and that scoped Claude wiring expressly disclaims authority. It includes synthetic negative cases to prove the check fails on a broken reference. The check is a **drift guard**, not a semantic theorem prover; reviewers still need to inspect any new policy prose for contradictions.

To change a shared rule, update its **owner** first; adapters should link to it, not reprint it. This PR does not modify root `AGENTS.md`, production behavior, or any protected domain.
