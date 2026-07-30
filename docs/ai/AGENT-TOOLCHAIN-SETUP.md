# Working with AI agents on this repo

This project is set up so an AI coding agent can work on it safely. That setup is **committed to the repo** — you get all of it when you clone. This page explains what's there, what you have to install yourself, and how to actually use it.

Read [FIRST-TIME-SETUP.md](../FIRST-TIME-SETUP.md) first if you haven't got the app running yet.

---

## 1. The one thing to understand first

**You are not supposed to name tools.**

`AGENTS.md` states the design goal directly:

> The repository supplies the process — the user should never have to name Graphify, Repomix, Superpowers, Impeccable, a specific skill, a domain playbook, tests, or a risk tier. You infer all of that.

So you talk to the agent in plain, messy, product language:

> "the events page lowkey looks ass on mobile fix it"

…and the repo's own configuration routes that into: classify the risk → load the right knowledge → find the right files → make the change → verify it → report evidence.

If you find yourself typing "use the vsa-events-gallery playbook and load the design system skill," something has gone wrong — either the routing isn't working, or you're overriding it unnecessarily.

---

## 2. What's already in the repo

You get all of this from `git clone`. Nothing to install.

| Path | What it is |
|---|---|
| **`AGENTS.md`** | The authoritative governance contract. Protected domains, the never-do list, branch/PR rules. **When anything contradicts anything, this wins.** |
| **`docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md`** | The canonical *how* — 18 sections covering risk classification, routing, verification, and adversarial review. |
| **`CLAUDE.md` / `GEMINI.md` / `ANTIGRAVITY.md`** | Per-tool adapters. Same rules, different mechanics. |
| **`.claude/skills/`** | 16 domain knowledge packs (`vsa-*`) plus Graphify. Loaded on demand — never all at once. |
| **`.claude/agents/`** | 12 domain playbooks — specialist personas for events, House, points, admin, security, etc. |
| **`.claude/settings.json`** | A hook that suggests Graphify when you're about to do a broad `grep`. |
| **`.codex/` and `.gemini/`** | Equivalent config for Codex and Gemini CLI. |
| **`graphify-out/`** | A pre-built knowledge graph of the codebase, committed so you can read it without installing anything. |
| **`docs/*-subagent-workflow.md`** | Per-tool delegation guides and fill-in task templates. |

### Skills vs playbooks

Easy to conflate, genuinely different:

- **Skills** (`.claude/skills/`) are **knowledge** — "here is everything true about seasonal content on this site."
- **Playbooks** (`.claude/agents/`) are **personas** — "act as the House system specialist, with these boundaries."

Two playbooks are deliberately **read-only**: `vsa-architecture-guardian` and `vsa-points-attendance-guardian`. They audit and recommend; they don't make sweeping edits. That's on purpose.

---

## 3. What you have to install

These live on your machine, not in the repo.

### Your agent of choice

Claude Code, Codex, or Gemini CLI — the repo supports all three. Start with whichever you have access to.

### Graphify (optional but recommended)

Indexes the codebase into a queryable graph, so architectural questions don't require reading twenty files:

```bash
./scripts/graphify-run query "how does check-in write points?"
./scripts/graphify-run explain "src/data/repos/leaderboard.ts"
./scripts/graphify-run path "src/pages/Events.tsx" "supabase/migrations"
```

Use `./scripts/graphify-run`, not bare `graphify` — the wrapper finds the binary across install locations.

**You can skip installing it at first.** The graph output is committed, so `graphify-out/GRAPH_REPORT.md` is readable immediately and `graphify-out/graph.html` opens in a browser. You only need the binary to run live queries or regenerate.

### Superpowers and Impeccable

`AGENTS.md` assumes both are available:

> Use **Superpowers** methodology (plugin installed; workflow doc §6 summarizes it) for meaningful work; **Impeccable** for meaningful UI (never replacing the design system).

These are **user-level plugins**, not repo files — installing them is per-machine. In Claude Code, browse and install with the `/plugin` command. **Ask Havyn for the exact source** rather than guessing; he has them working.

Neither is required to contribute. Without them the agent falls back to the repo's own process, which is the part that actually matters.

### MCP servers (optional)

There's no repo-level MCP config, so servers like Supabase or GitHub are configured per-machine. Not needed for normal work.

---

## 4. How to actually use it

### Start with the problem, not the solution

**Good:** "the leaderboard is unreadable on my phone"
**Less good:** "add overflow-x-auto to the leaderboard table"

The first lets the agent classify risk and route correctly. The second skips straight to an implementation that might be wrong.

### Say what you want, not how to get it

You don't need to say "read `vsa-design-system-reference` first." A correctly-routed agent does that on its own. If it obviously didn't, that's worth reporting — it's a routing bug.

### Expect more process on protected work

The repo scales rigor to risk. A typo fix is a typo fix. But anything touching **attendance import, points calculation, House membership, the leaderboard, or database permissions (RLS)** triggers the full process: explicit acceptance criteria, tests first, an audit-first review, and owner sign-off.

If an agent breezes through a change in one of those areas without pushback, **be suspicious** — it probably didn't load `vsa-change-control`.

### Demand evidence, not claims

`AGENTS.md` sets the bar: an agent should report what it ran and what the output was. "Tests pass" is not evidence. Actual test output is.

Two specific things to watch for:

- An agent claiming a subagent/playbook ran when it didn't. `AGENTS.md` L229 calls this out explicitly for Codex.
- An agent saying "this should work" about something it never executed.

Both are worth pushing back on. It's a normal part of the workflow, not rudeness.

### Ask it to explain the codebase

Genuinely the fastest way to learn this project:

> "explain how points get from an event to the leaderboard"

> "what happens on the site during summer break?"

> "why are there two points systems?"

That last one has a real answer, and it's the most important thing to understand before touching anything points-related.

---

## 5. Things that will bite you

| Trap | What's going on |
|---|---|
| Docs contradicting code | The repo has drifted before, and knows it. `CLAUDE.md` says to re-derive the provider hierarchy from `src/App.tsx` rather than trust any doc. When docs and code disagree, **code wins** — then fix the doc. |
| "Dead" code that isn't | Member accounts are parked but their auth plumbing is live for admin sign-in. Deleting "unused" code here is how you break login. |
| Two points systems | The public leaderboard and the check-in flow read and write **different tables** and are not reconciled. Never fix a leaderboard number by writing to the check-in tables. See `docs/leaderboard-system.md`. |
| Agents being confidently wrong | They will state stale facts with total confidence. Verify anything load-bearing against source. |
| Committing Graphify noise | `graphify-out/cache/` and `cost.json` are gitignored. Graph updates belong in their own `chore: update graphify graph` commit, never mixed into a feature PR. |

---

## 6. A note on hooks

`.claude/settings.json` and `.codex/hooks.json` contain **hooks — shell commands that run automatically** when the agent uses certain tools. The ones here are harmless (they print a hint suggesting Graphify before a broad `grep`).

Worth knowing generally: because hooks execute on whoever's machine has the repo checked out, agent configuration is executable code, not just settings. That's why `.claude/` is listed in [`.github/CODEOWNERS`](../../.github/CODEOWNERS) — changes there need review, same as any other code.

---

## 7. Where to go next

| You want | Read |
|---|---|
| The rules, authoritatively | [`AGENTS.md`](../../AGENTS.md) |
| The full workflow | [`AGENTIC-ENGINEERING-WORKFLOW.md`](AGENTIC-ENGINEERING-WORKFLOW.md) |
| Graphify specifics | [`docs/graphify-workflow.md`](../graphify-workflow.md) |
| Delegating to a specialist | [`docs/claude-subagent-workflow.md`](../claude-subagent-workflow.md) · [`codex`](../codex-subagent-workflow.md) · [`gemini`](../gemini-cli-workflow.md) |
| What to work on | [`docs/DEVELOPMENT-ROADMAP.md`](../DEVELOPMENT-ROADMAP.md) |

**Don't try to read all 16 skills.** They're reference material, loaded on demand. Read `AGENTS.md`, skim the workflow doc, and let the rest arrive when it's relevant.
