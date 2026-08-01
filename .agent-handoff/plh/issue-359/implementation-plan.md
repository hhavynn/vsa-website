# Implementation plan — issue #359 (license + code-vs-content boundary)

## Confirmed state

- No `LICENSE` file (`gh repo view` → `licenseInfo: null`).
- `package.json` has **no** `license` field.
- `README.md` L157-159 has a `## License` section that says: "No LICENSE file is currently checked into this repository."
- Repo is **public** since 2026-07-31, so it currently sits under default copyright: all rights reserved, nobody may legally reuse the code.
- `public/images/` contains `cabinet/`, `events/`, `gallery/`, `2024events/` — photographs of identifiable students.

## The decision (SETTLED by the repository owner — implement exactly this)

The owner has specified the licensing model. Do not re-open it, do not offer alternatives.

- **Original software code authored for this repository: MIT License.**
- **Non-code content is NOT covered by MIT** — site copy, photographs, logos, videos, archives, datasets, member information, and application content remain **all rights reserved** by their applicable owner unless a file is explicitly licensed otherwise.
- **Third-party assets retain their original licenses.**
- **VSA and related marks are not granted for reuse** through the software license.
- Private or sensitive material is not made reusable merely because the repo is public.

Copyright holder is the **organization** — "Vietnamese Student Association at UC San Diego" — **not** any individual contributor.

## Non-goals

- Do NOT claim to give legal advice, and do NOT add language asserting legal conclusions the repo cannot support.
- Do NOT invent ownership claims. Where ownership is genuinely unclear (e.g. a photo whose photographer is unknown), use conservative language and name the uncertainty rather than asserting the org owns it.
- Do NOT add per-file SPDX headers across the source tree — noisy, high-churn, and not required by the decision.
- Do NOT relicense or alter anything under `node_modules/`, or any vendored third-party file.
- Do NOT modify application source, tests, or migrations. This is a policy/docs change only.
- Do NOT delete or move any image.

## Expected files to change

- **New `LICENSE`** — standard MIT text, `Copyright (c) 2026 Vietnamese Student Association at UC San Diego`. Use the canonical MIT wording; do not paraphrase it.
- **New `NOTICE.md`** — the authoritative code-vs-content boundary. This is the substantive document.
- **`README.md`** — replace the L157-159 "No LICENSE file..." section with a short, accurate summary that links `LICENSE` and `NOTICE.md`.
- **`package.json`** — add `"license": "MIT"` (valid SPDX identifier; describes the code, consistent with `LICENSE`).
- **`.github/CONTRIBUTING.md`** — a short paragraph on contributor expectations: contributions of code are under MIT; do not commit third-party assets or member photographs without confirming rights.

## What NOTICE.md must contain

1. **Plain statement of the split**: code is MIT (`LICENSE`); everything else is not.
2. **Explicit list of what is NOT MIT-licensed**, tied to real paths in this repo:
   - `public/images/**` — including `cabinet/`, `events/`, `gallery/`, `2024events/` — photographs of identifiable students.
   - The VSA at UCSD name, logo, and brand marks.
   - Site copy, event descriptions, archives, and written content.
   - Any dataset or export containing member information.
3. **Trademark reservation** — the MIT grant covers code only and conveys no right to use the organization's name or marks.
4. **Third-party assets** retain their original licenses; the MIT grant does not extend to them. Fonts and dependency licenses are governed by their own terms.
5. **Photograph caveat, stated conservatively**: photographs are published for the organization's own use and are not licensed for redistribution; if someone believes an image of them should be removed, there is a contact path — point at the reporting channel in `SECURITY.md` or the repository issue tracker. Do **not** invent an email address; the repo publishes none.
6. **A short note that forking the repository does not grant rights to the non-code content.**

Keep it readable. A reuser skimming it must be able to answer "can I fork this for my own student org?" in under a minute. The answer is: yes for the code, no for the photos, copy, and branding.

## Security and privacy implications

This is the item with real-world consequences for real people: identifiable students' photographs are in a public, forkable repository. This PR does **not** solve that — it makes the licensing position explicit so a permissive code license is not mistaken for permission to redistribute member images.

Whether the existing consent basis (`docs/member-photo-requests.md`, `docs/privacy-data-rights-architecture.md`) covers publication in a public git repo is a **separate open question** that this PR must not claim to resolve. Note it in the report as remaining work.

## Deployment implications

None. No runtime code changes.

## Tests

None. Policy/docs only, plus one additive `package.json` field. Do not invent tests.

## Verification Codex must run, pasting real output

```
git --no-pager diff --stat
git status --short
node -p "require('./package.json').license"
npm run build
CI=true npx react-scripts test --watchAll=false
```

Required:
- `package.json` still parses and reports `MIT`.
- Build and all tests pass (they should be unaffected).
- Only the five files listed above changed.

## Rollback

Revert the commit; the repo returns to unlicensed. No runtime impact either way.

## Blocker conditions

- Finding a pre-existing conflicting license or CLA in the repo that contradicts the MIT decision.

## Definition of completion

`LICENSE` (MIT, organization as holder) and `NOTICE.md` exist; README and `package.json` agree with them; the code-vs-content boundary is explicit and path-specific; no private data, member content, trademark, or third-party asset is accidentally licensed; build and tests pass.
