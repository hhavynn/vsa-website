---
name: vsa-design-system-reference
description: Load before writing or reviewing ANY UI code for the VSA website — new components, pages, restyles, mobile layouts, dark-mode work, animations, loading states, or when you're about to type a Tailwind class. Provides the semantic color-token system (surface/text tokens, brand-600/brand-400), type scale, radii/shadow rules, dark-mode mechanics, Framer Motion conventions (easing, durations, reduced-motion), the component layering rules (ui/ vs common/ vs features/ vs layout/), the established mobile patterns (BottomSheet, snap rail, quick dock, skeletons, drawer), and the accessibility floor. Trigger keywords: Tailwind, styling, dark mode, colors, tokens, framer-motion, animation, mobile UI, bottom sheet, skeleton, design system, "make it beautiful".
---

# VSA Design System Reference

**What this is for.** The VSA website has an established, deliberate design language (warm-parchment light mode, midnight-teal dark mode, sharp radii, border-driven structure, one shared easing curve). This skill is the knowledge pack that lets you produce UI that matches that language instead of generic Tailwind output. The owner's stated top priority (2026-07-05) is "maximizing mobile UI and making the entire website's UI beautiful and unique" — everything here exists so new UI extends that identity rather than diluting it.

**When NOT to use this skill:**

| You are trying to… | Use instead |
|---|---|
| Execute the mobile/UI-excellence campaign (phases, gates, ranked options) | `vsa-ui-excellence-campaign` |
| Decide whether a UI change is allowed / how to get it approved | `vsa-change-control` |
| Prove a UI change works (lint/build/test commands, QA checklists) | `vsa-validation-and-qa` |
| Add routes, providers, data fetching behind the UI | `vsa-architecture-contract` |
| Debug broken UI, wrong colors, dark-mode bugs | `vsa-debugging-playbook` |

Note: the **`impeccable`** design skill (generic frontend-craft playbook) is installed and available to Claude sessions — use it for design *judgment* (hierarchy, polish, critique). Use *this* skill for the project-specific facts it can't know.

---

## 1. Color tokens (tailwind.config.js — the only place brand colors change)

### Brand palettes (hex literals in `tailwind.config.js`)

| Palette | Steps | Anchors | Role |
|---|---|---|---|
| `brand` (VSA teal, from the logo's sky) | 50–950 | **600 = `#1e8878` light-mode primary CTA**, **400 = `#3bbdb5` dark-mode primary**, 700 = `#196e60` hover | Primary interactive color |
| `coral` (lantern red-orange) | 400/500/600 | 500 = `#e8623a` | Accent |
| `gold` (cloud amber) | 400/500/600 | 500 = `#d4841a` | Accent |

**Rule (AGENTS.md "Styling"):** prefer `brand-600` in light mode / `brand-400` in dark mode for primary interactive elements. `Button` variant `primary` is the canonical example: `bg-brand-600 … dark:bg-brand-400 dark:text-[#050810]`.

### Semantic surface/text tokens — CSS-variable-driven, auto dark

`tailwind.config.js` aliases these Tailwind color names to CSS custom properties, so **dark mode flips them automatically with zero `dark:` variants**:

| Tailwind class | CSS var | Light | Dark |
|---|---|---|---|
| `bg-surface` | `--color-surface` | `#ffffff` | `#0d1a20` |
| `bg-surface2` | `--color-surface2` | `#fdf7f0` (warm off-white) | `#122430` |
| `border-border-strong` | `--color-border-strong` | `#c4b8a8` | `#2a4850` |
| `text-text-primary` | `--color-text` | `#142028` (teal-charcoal) | `#e4d8c8` (warm cream) |
| `text-text-secondary` | `--color-text2` | `#4a6b68` | `#6a9a94` |
| `text-text-muted` | `--color-text3` | `#90aaa8` | `#2a5050` |

The variables live in `src/index.css` — light values under `:root`, dark under `html.dark`. More vars exist there than have Tailwind aliases (`--color-bg` `#f5f1ea` warm parchment page background, `--color-border`, `--color-nav`, `--color-input`, `--color-sidebar*`, `--color-brand/accent/gold`); existing components reach them with arbitrary-value syntax, e.g. `border-[var(--color-border)]`, `text-[var(--color-text2)]`, `ring-offset-[var(--color-bg)]` (see `src/components/ui/Button.tsx` variants `outline`/`ghost`).

**Hard rule (AGENTS.md):** never hardcode `text-gray-900` / `bg-white` pairs. Use the semantic tokens.

The palette story (documented in the `src/index.css` header comment): teal sky → primary, coral lantern → accent, warm gold clouds → accent, cream → light backgrounds. All drawn from the VSA logo. New colors must fit this story or not exist.

## 2. Typography, spacing, radii, shadows (tailwind.config.js)

- **Fonts:** `font-sans` = "DM Sans", `font-serif` = "DM Serif Display" (display headings), `font-mono` = "JetBrains Mono". Loaded via `<link>` in `public/index.html` (the `src/index.css` header notes this — do not add `@import` font loads).
- **Type scale is compact and custom** — `text-base` is **14px**, not Tailwind's default 16px. Full scale: `2xs` 10 / `xs` 12 / `sm` 13 / `base` 14 / `md` 15 / `lg` 16 / `xl` 18 / `2xl` 20 / `3xl` 24 / `4xl` 30 / `5xl` 36 / `6xl` 48, each with a tuned line-height. Don't assume stock Tailwind sizes.
- **Letter spacing:** `tracking-label` = `0.07em`, reserved for uppercase section labels. `tighter` −0.04em, `tight` −0.025em.
- **Spacing:** stock Tailwind 4px/8px grid plus extras `18` (72px), `88` (352px), `128` (512px).
- **Radii — "sharp, engineered look":** `rounded-sm` 2px (badges), `rounded` 4px (standard), `rounded-md` 6px, `rounded-lg` 8px (modals), `rounded-xl` 12px (large surfaces, sparingly), `rounded-full`. Big soft blobs are off-language (exception: BottomSheet uses `rounded-t-2xl` for the mobile sheet lip).
- **Shadows — "structure via borders, not blur":** only `shadow-card` (subtle two-layer) and `shadow-none` are defined. Give elements structure with `border border-[var(--color-border)]`, not drop shadows.
- **CSS animations:** `animate-fade-in` (0.15s ease-in opacity) is the only Tailwind animation token — use it for simple fades; use Framer Motion for anything more (§4). Transition durations `150`/`250` ms are defined.

## 3. Dark mode mechanics

- `darkMode: 'class'` in `tailwind.config.js`. The `dark`/`light` class lives on `<html>`.
- `src/context/ThemeContext.tsx` owns it: an inline FOUC-prevention script in `public/index.html` stamps the class before React loads; `getInitialTheme()` reads that class first, then `localStorage['theme']`, then `prefers-color-scheme`. `useTheme()` gives `{ theme, toggleTheme }` (toggle UI: `src/components/layout/ThemeToggle.tsx`).
- **When you need `dark:` variants vs. when you don't** (AGENTS.md): semantic tokens (§1) flip automatically — reach for them first. Use `dark:` variants **only when the semantic tokens are insufficient**, i.e. when the two modes need genuinely different treatments: brand-step swaps (`bg-brand-600 dark:bg-brand-400`), opacity tints (`dark:bg-brand-600/10`), status colors (`bg-red-700 dark:bg-red-500`). `src/components/ui/Button.tsx` shows both patterns side by side.
- Never write a light-mode hex and forget dark mode; if you can't express it with tokens, you must supply the `dark:` pair.

## 4. Motion language (Framer Motion conventions)

All four canonical components live in `src/components/ui/` and share the same grammar. Extracted conventions:

| Convention | Value | Evidence |
|---|---|---|
| House easing curve | `ease: [0.22, 1, 0.36, 1]` (fast-out, gentle settle) | `SplitText`, `AnimatedCounter`, `FadeContent` |
| Content-reveal duration | 0.4–0.62 s | `FadeContent` 0.4, `SplitText` 0.62 |
| Sheet/dialog physics | `{ type: 'spring', damping: 34, stiffness: 340 }` | `BottomSheet` |
| Reduced motion | `useReducedMotion()` → render final state immediately (or plain fade) | all four |
| Scroll reveal | `whileInView` + `viewport={{ once: true, margin: '-40px' }}` | `FadeContent` |
| Stagger | caller passes `delay = index * step`; char stagger 0.035 s | `FadeContent`, `SplitText` |

Canonical examples (read these before writing new motion):

1. **Hero text — `SplitText`** (`src/components/ui/SplitText.tsx`, homepage hero, commit `e0feb783`): per-character `initial={{ opacity: 0, y: 34, filter: 'blur(10px)' }}` → animate to rest, 0.62 s house easing, 0.035 s char stagger. Wrapper carries `aria-label={text}`, each char is `aria-hidden` — screen readers get whole words. Paired with `ThreadsBackground` (`src/components/ui/ThreadsBackground.tsx`) whose drift/pulse keyframes live in `src/index.css` (`vsa-threads-drift`, `vsa-threads-pulse`).
2. **Number tick — `AnimatedCounter`** (`src/components/ui/AnimatedCounter.tsx`, leaderboard, commit `2403cff9`): imperative `animate(from, to, { duration: 1.1, ease: [0.22,1,0.36,1] })`; rendered with `fontVariantNumeric: 'tabular-nums'` so layout never shifts while digits tick; reduced-motion renders the final value instantly.
3. **Dense-layout reveal — `FadeContent`** (`src/components/ui/FadeContent.tsx`, admin dashboard, commit `a28a116e`): opacity + 12px rise, once, on scroll into view. Its own doc comment states the rule: "no scale, no bounce — just a quiet settle so dense admin layouts stay readable."
4. **Modal/sheet — `BottomSheet`** (§5.1): spring for the phone sheet, 0.96-scale fade for desktop.

**Reduced-motion is non-negotiable:** every new animated component must check `useReducedMotion()` (Framer) or a `@media (prefers-reduced-motion: reduce)` block (CSS — see `.skeleton-shimmer` and the snap-rail section in `src/index.css`) and degrade to a static/instant render.

## 5. Mobile pattern inventory (reuse these — do not reinvent)

The mobile toolkit was built commit-by-commit on the current UI campaign. Each entry: where, when to use, implementation notes.

### 5.1 BottomSheet — mobile-first modal (`src/components/ui/BottomSheet.tsx`, commit `feb4b263`)

- **When:** any modal/detail dialog that members will open on a phone. Existing adopters: `src/components/features/calendar/CalendarDetailModal.tsx`, `src/pages/Leaderboard.tsx`. (`src/components/common/Modal.tsx` still exists for legacy admin surfaces.)
- **How it behaves:** below 640px (`(max-width: 639px)`) it slides up from the bottom with a drag handle and drag-to-dismiss (dismiss past 120px offset or 500 px/s downward velocity); at `sm+` it's a centered fade/scale (0.96) dialog. Handles backdrop click, Escape, body scroll-lock, focus, `role="dialog"` + `aria-modal`.
- **Key API note:** it self-manages its exit animation via internal `closing` state, so callers keep a plain conditional render — **no `AnimatePresence` wiring needed**. Props: `onClose`, `className` (panel background/border — pass surface tokens), `ariaLabel`/`ariaLabelledBy`.

### 5.2 Skeleton loading states (commit `acdc00b1`)

- **Base block:** `src/components/ui/Skeleton.tsx` — a `div.skeleton-shimmer` shaped entirely by caller-passed classes; `aria-hidden`. The shimmer keyframe + reduced-motion static fallback live in `src/index.css` (`vsa-skeleton-shimmer`, `--shimmer` var themed per mode).
- **Page-shaped compositions:** `src/components/common/PageSkeletons.tsx` exports `LeaderboardSkeleton`, `GallerySkeleton`, `CabinetSkeleton`, `EventsSkeleton` — used by those pages while react-query loads.
- **Beware the duplicate:** an older `src/components/common/Skeleton.tsx` also exists (exports `Skeleton`, `EventCardSkeleton`, `ProfileSkeleton`, `TableSkeleton`). Two Skeleton files, different APIs. For new work use `ui/Skeleton.tsx` + a composition in `PageSkeletons.tsx`; don't add a third.
- **When:** any page/section whose first paint waits on Supabase. Skeletons should echo the real layout's shapes (see `PageSkeletons.tsx` for the fidelity bar).

### 5.3 Mobile quick-nav dock (`src/components/layout/navigation/MobileQuickDock.tsx`, commit `5902bdd6`)

- **What:** fixed bottom dock on phones with four `NavLink`s — Home `/`, Events `/events`, Gallery `/gallery`, Ranks `/leaderboard`. Mounted once in `src/components/layout/Layout.tsx`.
- **Behavior:** hidden on route prefixes `/admin` and `/signin`; always visible within 80px of page top; auto-hides on scroll-down and reveals on scroll-up (6px jitter deadband, `requestAnimationFrame`-throttled); re-reveals on route change; respects `useReducedMotion`.
- **When touching it:** adding a 5th item or new hidden route = edit the `dockItems` / `hiddenPathPrefixes` arrays. Don't build a second bottom bar anywhere — it owns that real estate.

### 5.4 Swipeable snap rail (`.snap-rail` CSS in `src/index.css`, commit `368fbf63`)

- **What:** a mobile-only (media-queried) horizontal scroll-snap treatment: `scroll-snap-type: x mandatory`, momentum scrolling, hidden scrollbar, `scroll-snap-align: start` on children, `.snap-rail-container` with an `::after` edge-fade affordance.
- **Adopter:** `src/components/features/home/ThisWeekInVSA.tsx` — card grid on desktop becomes a swipeable rail on phones.
- **When:** any card grid that would stack into a long vertical scroll on mobile. It's pure CSS — add the classes, no JS. (This is the sanctioned exception pattern for `src/index.css` additions: reusable, systemic CSS, not per-component styles.)

### 5.5 Mobile drawer (`src/components/layout/navigation/MobileDrawer.tsx`)

- **What:** the hamburger navigation panel. Implements a real focus trap (queries focusable elements, wraps Tab/Shift-Tab, focuses first item on open, restores focus to the previously-focused element on close), `aria-modal="true"`, `aria-label="Navigation menu"`, `AnimatePresence` + `useReducedMotion` for enter/exit.
- **When:** navigation only. For content dialogs use BottomSheet (§5.1). If you build any new trapping overlay, copy this file's focus-trap approach — it's the house reference implementation. Note the a11y audit still lists *verifying* this trap as an OPEN manual check (§7).

## 6. Component layering — where new UI code goes

| Layer | Path | Contents (verified by `ls`, as of 2026-07-06) | Rule |
|---|---|---|---|
| Primitives | `src/components/ui/` | `AnimatedCounter, Badge, BottomSheet, Button, Card, FadeContent, Input (+Textarea), Label, ProfileSpotlightCard, Skeleton, SplitText, SpotlightCard, ThreadsBackground` | Generic, domain-free atoms. **Use them; don't reinvent** (AGENTS.md) |
| Shared | `src/components/common/` | `AnalyticsConsentBanner, ApplicationCTA, ContentUnavailableState, CountdownTimer, DegradedModeBanner, ErrorBoundary, Modal, OptimizedImage, PageError, PageLoader, PageSkeletons, PageTitle, PaginationControls, RevealOnScrollWrapper, RouteTracker, Skeleton` | Cross-feature utilities with app knowledge |
| Features | `src/components/features/<domain>/` | domain folders (ace, admin, auth, calendar, events, home, points, wrapped, …) | Heavy UI logic lives here; pages stay thin orchestration |
| Shell | `src/components/layout/` (+ `navigation/`) | `BackToTop, Footer, Header, Layout, ThemeToggle`; nav: `GetInvolvedDropdown, MobileDrawer, MobileQuickDock, NavigationShell, NavLinks, NavLogo, UserMenu` | One shell; don't fork it |

Conventions (AGENTS.md "Components"):
- **Named exports** everywhere, **except** lazy-loaded page modules in `src/pages/` (CRA's `React.lazy` needs a default export). Match the existing file's style in the same directory.
- **`cn()` from `src/lib/utils.ts`** (= `twMerge(clsx(...))`) for all conditional class names — never string concatenation. It also resolves Tailwind conflicts, so `cn('p-4', className)` lets callers override padding safely.
- Key primitive APIs (read the file before extending): `Button` — `variant: 'primary'|'secondary'|'outline'|'ghost'|'danger'|'success'`, `size: 'sm'|'md'|'lg'`, `loading`, `fullWidth`, forwardRef, `focus-visible:ring-2` built in. `Badge` — `label`, `color: 'blue'|'green'|'red'|'yellow'|'purple'|'gray'`. `Card` — `padding: number|string` prop (default 18, applied via `style`); its own doc comment states the layout philosophy: "Minimal card — use sparingly. Prefer open border-divided layouts."

## 7. Accessibility floor (docs/final-compliance-reaudit.md, Pillar 1: WCAG 2.1 AA)

Audited-and-fixed baseline — every new UI change must preserve it:

1. **Heading hierarchy:** single `<h1>` per page, sequential `<h2>–<h6>`, semantic `header/footer/main` landmarks.
2. **Form controls:** every input associated with a `<label>` or `aria-label`/`aria-labelledby` (there's a `Label` primitive in `ui/`).
3. **Images:** content images get non-empty descriptive `alt`; decorative assets get `alt=""` or `aria-hidden="true"`.
4. **Keyboard:** clickable elements reachable in logical tab order, operable via Enter/Space, with visible focus states (`Button` bakes in `focus-visible:ring-2 ring-offset-2`).
5. **Reduced motion:** house convention (§4), enforced in every motion component shipped so far.

Still-OPEN manual checks from the same doc (don't claim these verified; closing one is a legitimate task):
- **OPEN — Mobile drawer focus trap:** verify focus stays inside `MobileDrawer` when open and restores to the menu button on close (code exists, §5.5; live verification pending).
- **OPEN — Toast live regions:** confirm `react-hot-toast` announcements use `role="status"` / `aria-live="polite"` correctly.
- **OPEN — Contrast:** verify ≥ 4.5:1 for normal text in BOTH modes, especially `var(--color-text3)` (`#90aaa8` light / `#2a5050` dark — the riskiest token; avoid it for essential text) and brand colors on tinted surfaces.

## 8. Hard styling rules (AGENTS.md "Styling" — with rationale)

1. **Tailwind only.** No inline `style` props, no CSS modules, **no new `.css` files** unless truly unavoidable — `src/styles/ace.css` is the documented lone precedent for that exception. (`src/index.css` holds the token vars and a few systemic patterns like `.snap-rail`/`.skeleton-shimmer`/`scrapbook-*`; `src/App.css` is legacy CRA residue — don't grow either with per-component styles.) *Rationale:* one styling system keeps dark mode, purging, and refactors mechanical. Pragmatic exceptions that already exist in-tree: `style` for truly dynamic values only (e.g. `transform: rotate()` on scrapbook cards, `fontVariantNumeric` in AnimatedCounter, `Card`'s numeric padding) — never for colors/spacing that tokens can express.
2. **Semantic tokens over raw grays** (§1). *Rationale:* every hardcoded `bg-white` is a dark-mode bug waiting to ship.
3. **`brand-600` light / `brand-400` dark** for primary interactive elements. *Rationale:* 600 passes contrast on cream; 400 passes on midnight.
4. **Framer Motion for enter/exit; `animate-fade-in` for simple opacity fades.** *Rationale:* keeps two motion systems from fighting, and Framer's `useReducedMotion` carries the a11y guarantee.
5. **No heavy UI dependencies.** The house pattern — proven across this branch (`codex/reactbits-ui`) — is to **re-implement reactbits-style components as small in-repo files using the existing `framer-motion` dependency** (`SplitText`, `FadeContent`, `AnimatedCounter`, `SpotlightCard`, `ThreadsBackground` are exactly this), never `npm install` a component/animation library. *Rationale:* bundle size is watched (`npm run analyze`), CRA has no tree-shaking escape hatches, and owned code matches the token system.
6. Adding a dependency, touching protected surfaces, or shipping a sweeping restyle goes through `vsa-change-control` first; watch its freeze windows (House reveals, application opens, VCN).

## 9. Aesthetic identity — what's real vs. aspirational

**Merged and real (as of 2026-07-06):**
- The **token identity** (§1–2): warm parchment + teal/coral/gold, sharp radii, border-driven structure, DM Sans/DM Serif Display. This is the load-bearing aesthetic — it's everywhere.
- The **motion identity** (§4) and **mobile toolkit** (§5), shipped on `codex/reactbits-ui` (commits `e0feb783`, `2403cff9`, `a28a116e`, `feb4b263`, `acdc00b1`, `5902bdd6`, `368fbf63`, `922305b8`).
- A **partial scrapbook treatment**: reusable classes `scrapbook-paper`, `scrapbook-tape-teal/coral/gold`, `scrapbook-pin` (defined in `src/index.css`) with slight `rotate()` transforms — applied to the Wrapped recap card (`src/components/features/home/WrappedRecapCard.tsx`, commit `29ad2114`) and to some public-page styling passes (commits `8366e279` "refine public pages with scrapbook styling (#82)", `a622833e` "merge scrapbook styling with minimal animations", `f1499d61` UVSA Network). It is an accent voice for memory/recap/photo surfaces — **not** a site-wide system.

**Candidate / aspirational (do NOT present as shipped):**
- A full scrapbook/tape/pin redesign exists only on unmerged remote branches `feat/ui-redesign-scrapbook` and `codex/scrapbook-ui-sweep`. Treat "scrapbook everywhere" as a candidate direction; extending it beyond recap/photo/memory contexts needs owner sign-off via `vsa-change-control`.
- Rule of thumb when choosing a voice for a new surface: data-dense/admin → quiet FadeContent + tokens; celebratory/memory (Wrapped, gallery, recaps) → scrapbook accents are in-language; everything else → tokens + house motion, no tape.

## 10. Pre-merge self-check for any UI change

- [ ] No raw `text-gray-*`, `bg-white`, `bg-black` for themed surfaces — semantic tokens or documented `dark:` pairs
- [ ] Primary actions use `brand-600`/`dark:brand-400` (or the `Button` primitive, which does)
- [ ] Type sizes from the custom scale (remember `base` = 14px); labels use `tracking-label` + uppercase
- [ ] Radii ≤ `rounded-lg` for normal surfaces; structure via borders, not new shadows
- [ ] Motion uses house easing `[0.22, 1, 0.36, 1]` or the BottomSheet spring; reduced-motion path exists
- [ ] Mobile: modal → `BottomSheet`; loading → skeleton composition; card grid → `.snap-rail`; nothing collides with `MobileQuickDock`'s bottom strip
- [ ] `cn()` for conditional classes; named export; correct layer (§6)
- [ ] A11y floor (§7): headings, labels, alt, keyboard/focus-visible, contrast in BOTH modes
- [ ] No new npm UI deps; no new `.css` files; no inline `style` except truly dynamic values
- [ ] Verified per `vsa-validation-and-qa` before claiming done

## Provenance and maintenance

Sources (verified 2026-07-06, branch `codex/reactbits-ui`): `tailwind.config.js` (read in full); `src/index.css` (token vars, shimmer, snap rail, threads keyframes); `AGENTS.md` "Coding conventions" (Components, Styling); `src/context/ThemeContext.tsx`; `src/lib/utils.ts`; `src/components/ui/{Button,BottomSheet,Skeleton,SplitText,AnimatedCounter,FadeContent,Card,Badge,Input}.tsx`; `src/components/common/{PageSkeletons,Skeleton}.tsx`; `src/components/layout/navigation/{MobileQuickDock,MobileDrawer}.tsx`; `src/components/features/home/WrappedRecapCard.tsx`; `docs/final-compliance-reaudit.md` §2 (Pillar 1); commits `e0feb783`, `2403cff9`, `a28a116e`, `feb4b263`, `acdc00b1`, `5902bdd6`, `368fbf63`, `29ad2114`, `8366e279`, `a622833e`, `f1499d61`.

Re-verification one-liners (run when this feels stale):

```bash
grep -n "brand\|surface\|fontSize\|borderRadius\|boxShadow" tailwind.config.js   # tokens (§1–2)
grep -n ":root\|html.dark\|--color-" src/index.css | head -40                    # CSS vars (§1, §3)
ls src/components/ui src/components/common src/components/layout/navigation      # layer inventory (§5–6)
grep -rn "0.22, 1, 0.36, 1" src/components/ui                                    # house easing (§4)
grep -n "snap-rail\|skeleton-shimmer\|scrapbook-" src/index.css | head           # systemic CSS patterns (§5, §9)
git branch -r | grep -i scrapbook                                                # aspirational branches still unmerged? (§9)
sed -n '27,40p' docs/final-compliance-reaudit.md                                 # a11y floor + OPEN items (§7)
find src -name '*.css'                                                           # .css file count should stay at 3 (§8)
```
