# First-time setup

For contributors who haven't worked on a real project through GitHub before. It explains *why* each step exists, not just what to type — the point is to end up understanding the workflow, not just to get the site running.

Take your time. An hour is normal. Getting stuck is normal.

If you've done this before, skip to [CONTRIBUTING.md](../.github/CONTRIBUTING.md).

---

## What you're about to do

Five things, in order:

1. Install the tools (**git**, **Node**, **VS Code**)
2. **Clone** the repo — copy it from GitHub onto your computer
3. Add the **credentials** the site needs to talk to its database
4. **Run** it locally
5. Learn the **change → branch → commit → push → pull request** loop

Steps 1–4 happen once. Step 5 is what you'll repeat forever.

---

## The vocabulary

Worth knowing before you start — these words get used constantly and nobody defines them.

| Term | What it means |
|---|---|
| **Terminal** | A window where you type commands instead of clicking. Also called shell or command line. |
| **Repository (repo)** | A project folder that git tracks. This project is one repo. |
| **Clone** | Download a copy of the repo to your machine, with its full history. |
| **Branch** | A parallel line of work. You make changes on your own branch so you don't disturb `main`. |
| **Commit** | A saved checkpoint with a message describing what changed. |
| **Push** | Upload your commits to GitHub. |
| **Pull request (PR)** | "Here are my changes, please review and merge them." Where code review happens. |
| **`main`** | The branch that represents the real, live site. **Never edit it directly.** |

---

## 1. Install the tools

### Open a terminal

- **Mac** — `Cmd + Space`, type `Terminal`, press Enter.
- **Windows** — install [Git for Windows](https://git-scm.com/download/win) first (below), then use **Git Bash** from the Start menu. Use Git Bash, not PowerShell — these instructions assume it.

You'll see a prompt waiting for input. When this guide says "run X," it means type X and press Enter.

### git

Check whether you already have it:

```bash
git --version
```

If you get a version number, you're done. Otherwise:

- **Mac** — running `git --version` will offer to install developer tools. Accept it. (Or `brew install git` if you use Homebrew.)
- **Windows** — [git-scm.com/download/win](https://git-scm.com/download/win), accept the defaults.

Then tell git who you are — this gets attached to every commit you make:

```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

Use the email tied to your GitHub account so your commits link to your profile.

### Node

Node runs JavaScript outside a browser. This project needs **version 20** — newer isn't better here, it will break the build.

Rather than installing Node directly, install **nvm**, which lets you switch versions per project. Real projects pin different versions; this will come up again.

**Mac / Linux:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```
Then **close and reopen your terminal**, and run:
```bash
nvm install 20
nvm use 20
```

**Windows:** install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases) (`nvm-setup.exe`), reopen the terminal, then:
```bash
nvm install 20
nvm use 20
```

Verify:
```bash
node --version    # should print v20.something
```

> This repo has a `.nvmrc` file containing `20`. In a project with one, `nvm use` picks the right version automatically — no need to remember.

### VS Code

Download from [code.visualstudio.com](https://code.visualstudio.com). When it offers to install the "code" command in PATH, say yes.

---

## 2. Clone the repo

First **accept the repo invitation** — check your email or [github.com/notifications](https://github.com/notifications). The repo is private, so cloning fails until you do.

Pick where the project should live and go there. `~` means your home folder:

```bash
cd ~
mkdir -p projects
cd projects
```

Then clone:

```bash
git clone https://github.com/hhavynn/vsa-website.git
cd vsa-website
```

You now have the whole project, including every commit ever made. Try:

```bash
git log --oneline -5
```

Those are the five most recent changes.

> **If it asks for a password:** GitHub stopped accepting account passwords over HTTPS. Either install the [GitHub CLI](https://cli.github.com) and run `gh auth login`, or create a [personal access token](https://github.com/settings/tokens) and paste that as the password.

---

## 3. Add credentials

The site reads its data from Supabase (the database), and needs two values to connect.

Create a file called `.env.local` in the project root. In VS Code:

```bash
code .
```

Then **File → New File**, save it as exactly `.env.local`, and paste:

```
REACT_APP_SUPABASE_URL=<ask Havyn>
REACT_APP_SUPABASE_ANON_KEY=<ask Havyn>
```

Two things worth understanding:

- `.env.local` is in `.gitignore`, so it is **never committed**. Credentials don't belong in a repo — that's a rule everywhere, not just here.
- The anon key is safe to have in a browser; the database enforces permissions server-side through something called RLS. But **never** put a secret key in a variable starting with `REACT_APP_` — those get compiled into the public site.

There's a `.env.example` in the repo showing which variables exist. That's a common convention: commit the *shape*, never the *values*.

---

## 4. Run it

Install the project's dependencies:

```bash
npm ci
```

This reads `package-lock.json` and downloads roughly a thousand packages into `node_modules/`. It takes a few minutes the first time and prints a lot. Warnings are normal; errors are not.

> **`npm ci` vs `npm install`:** `ci` installs exactly the locked versions. `install` may update the lockfile. Use `ci` unless you're deliberately adding a package.

Now start it:

```bash
npm start
```

Your browser opens [http://localhost:3000](http://localhost:3000). Edit any file, save, and the page updates instantly.

Leave this running while you work. **`Ctrl + C`** stops it.

### The other commands

```bash
npm test          # run the tests
npm run lint      # check code style
npm run build     # produce the production bundle
```

Run all three before opening a pull request. CI runs them too, and a red PR won't get merged.

---

## 5. Making a change

This is the loop. Everything above was setup; this part you'll do every time.

**Start from an up-to-date `main`:**

```bash
git checkout main
git pull
```

**Make a branch.** Name it `type/short-description` — `feat/` for a feature, `fix/` for a bug, `docs/` for documentation:

```bash
git checkout -b fix/event-card-spacing
```

**Make your change**, with `npm start` running so you can see it.

**Check what you changed:**

```bash
git status     # which files
git diff       # what exactly
```

Get in the habit of running `git diff` before every commit. It's how you catch the debug line you forgot to delete.

**Commit it:**

```bash
git add .
git commit -m "fix: correct spacing on event cards"
```

The message format matters here — it must start with `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `style:`, `perf:`, `ci:`, `build:`, `revert:`, or `security:`. A GitHub check rejects PR titles that don't. It's called Conventional Commits and it's widespread.

**Push:**

```bash
git push -u origin fix/event-card-spacing
```

**Open the pull request.** The push prints a link — click it. Or go to the repo on GitHub and hit "Compare & pull request."

Fill in the template. Be honest in the checklist: if you didn't run something, don't tick it. Then wait for review.

**Responding to review comments** is the normal case, not a sign you did badly. Make the changes, commit, push again — the PR updates automatically.

---

## Before you write code

Read **[AGENTS.md](../AGENTS.md)** in the project root. The important part:

Some areas are **off-limits without asking first** — anything touching attendance import, points calculation, House membership, the leaderboard, or database permissions (RLS). Not because they're hard, but because mistakes there are hard to detect and affect real members' data.

Everything else is fair game.

Also worth knowing:
- **Never commit directly to `main`.** Always a branch and a PR.
- **Never commit secrets** — keys, tokens, passwords.
- **Never run `npm run eject`.**

---

## When something breaks

Most problems have been hit before and written down.

| Symptom | Try |
|---|---|
| `Missing Supabase environment variables` | `.env.local` is missing, misnamed, or missing a variable. It must be in the project root. |
| Changes don't show up | Restart `npm start` — env vars are only read at startup. |
| `npm ci` fails | Check `node --version` is 20. If not, `nvm use 20`. |
| `command not found: npm` | Node isn't installed or the terminal needs reopening. |
| Tests fail with `Unexpected token 'export'` | Known issue — see `.claude/skills/vsa-build-and-env/`. |
| Permission denied when pushing | The invite wasn't accepted, or you need to authenticate — see the clone step. |

If you're stuck for more than 20 minutes, **ask.** Include what you ran and the exact error text. Being stuck is not a failure state; staying quiet about it is the only real mistake.

---

## Good first issues

Look for the **`good first issue`** label. Some need no coding at all — auditing the site on your phone, testing it with a screen reader — and those are genuinely useful, not busywork.

Avoid anything labelled `gated:change-control` (protected areas) or `blocked:external` (waiting on someone outside the code) until you've got your bearings.

---

## If this guide was wrong

If a step didn't work, that's a bug in the guide. Note what happened and open an issue or a PR fixing it — see **#326**. You're the only person who can find these; everyone else already has it working.
