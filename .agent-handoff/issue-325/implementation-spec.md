# Issue #325 — Add a dev container so contributors can start in one click

## Objective
`.devcontainer/devcontainer.json` already exists on `main` and was verified (by the controller, reading the file directly) to already satisfy nearly every acceptance criterion. The one confirmed gap: `.github/CONTRIBUTING.md` does not mention the devcontainer at all. Add that documentation. Do not touch `.devcontainer/devcontainer.json` itself — it is correct as-is.

## Confirmed requirements
Verified directly by the controller by reading `.devcontainer/devcontainer.json` on `main` before writing this spec:
- [x] Pinned to Node 22 (`"image": "mcr.microsoft.com/devcontainers/typescript-node:22"`) — matches #324.
- [x] `postCreateCommand: "npm ci"`.
- [x] Port 3000 forwarded (`forwardPorts: [3000]`).
- [x] Recommended extensions preinstalled: `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, `bradlc.vscode-tailwindcss`.
- [x] Env handling documented **inside the file itself** via a header comment: never bake Supabase credentials into `devcontainer.json` (it's committed); use Codespaces repository secrets instead, which CRA reads directly as `REACT_APP_*` env vars — no `.env.local` needed in a Codespace.
- [ ] **Not verified**: "Verified in both VS Code Dev Containers and a Codespace, not just one." This requires actually launching VS Code with the Dev Containers extension, or opening a real Codespace — neither is possible from a noninteractive CLI session. Do not claim this is done. Say plainly in your report that it remains a human verification step.
- [ ] **The actual gap**: `.github/CONTRIBUTING.md` doesn't mention the devcontainer as a setup path at all.

## Explicit non-goals
- Do NOT modify `.devcontainer/devcontainer.json`. It already meets the spec; changing it is out of scope and risks breaking something that works.
- Do NOT modify the production `Dockerfile` — unrelated, and explicitly forbidden by the issue's own guardrails.
- Do NOT claim VS Code/Codespaces runtime verification happened. It didn't, and can't from this environment. State that honestly.

## Acceptance criteria (for this spec's scope)
- [ ] `.github/CONTRIBUTING.md` gets a short addition — either its own small section or a paragraph appended to the existing "Environment setup" section — describing the devcontainer as an alternative to local install: what it is, that it works in both VS Code Dev Containers and GitHub Codespaces, and that credentials go through Codespaces secrets rather than `.env.local` in that context.
- [ ] The addition explicitly states it as "an alternative to local install, not a replacement" (this exact framing is required by the issue body).
- [ ] No other file changes.

## Relevant existing architecture
`.github/CONTRIBUTING.md` on this branch (`codex/expand-contributing-guide`) currently has, in order: intro, Environment setup, Protected domains, Freeze windows, Never do this, Branch naming, **Dependencies and the lockfile** (just added for #329), Dual points systems, PR title format, Pull request expectations. The natural home for this addition is inside or right after "Environment setup", since that's where local-install steps already live.

## Graphify findings
Not applicable — docs-only, no code architecture question.

## Relevant source files
- `.github/CONTRIBUTING.md` — the only file to change.
- `.devcontainer/devcontainer.json` — read-only reference, do not edit. Read it to describe it accurately rather than guessing its contents.

## Established implementation patterns to follow
Match the file's existing style (short, imperative, bold key terms, links authority rather than restating). The devcontainer file's own header comment is a good source of accurate phrasing for the credentials-handling note — read it and reflect its content, don't invent different wording.

## Data model or API implications
None.

## Security and privacy considerations
Do not write any real Supabase URL, key, or other credential into CONTRIBUTING.md, even as an example — reference the env var names only (`REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`), never values.

## Expected files to change
- `.github/CONTRIBUTING.md` only.

## Tests to add or update
None.

## Commands you must run
```
git diff --check
git status --short
```
Confirm `git status --short` shows exactly one modified file.

## Completion checklist
- [ ] Devcontainer documented in CONTRIBUTING.md as an alternative setup path
- [ ] Explicitly framed as "alternative... not a replacement"
- [ ] No credential values written anywhere
- [ ] `.devcontainer/devcontainer.json` untouched
- [ ] `git status --short` shows only `.github/CONTRIBUTING.md`
- [ ] Report written to `antigravity-result.md`, explicitly noting that VS Code/Codespaces runtime verification is NOT done and remains a human step

## Assumptions you may safely make
- Exact placement (new subsection vs. appended paragraph within Environment setup) is your call — pick whichever reads more naturally without disrupting the existing section's flow.

## Conditions that constitute a genuine blocker
- If `.devcontainer/devcontainer.json` does not exist or doesn't match what's described above when you check it yourself, stop — the spec's premise would be wrong and this needs to be re-planned, not guessed around.
