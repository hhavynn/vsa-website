# Type-checking

```bash
npm run typecheck        # TypeScript 5 over src/ (app + tests); runs in CI's `test` job
npm run typecheck:edge   # deno check over supabase/functions/**; runs in CI's `edge-functions` job
npm run build            # CRA build: TypeScript 4.9, target es5; still the final gate
```

## Why there is a separate `npm run typecheck`

`react-scripts` ships TypeScript 4.9 and the build type-checks with it. Two things made that check weaker than it looks:

1. **TypeScript 4.9 cannot parse zod's v4 typings** (`node_modules/zod/v4/**/*.d.cts` use newer syntax). A plain `tsc --noEmit` reports those syntax errors and then **skips semantic checking entirely**, so it passes or fails for the wrong reason.
2. **Jest never type-checks.** Babel strips types, so a test file with a wrong argument type or a misspelled enum value runs green. Only a real type-check sees those.

`npm run typecheck` runs a pinned TypeScript (5.6.3, fetched by `npx`, no change to `package.json` dependencies or the lockfile) against `tsconfig.typecheck.json`, which extends the real `tsconfig.json`. Bumping the repo's own `typescript` is a separate decision because `react-scripts` 5 declares `^3 || ^4` as its peer range.

## Why `tsconfig.typecheck.json` sets `target: es2015`

TypeScript 5 rejects the `u` regex flag under `target: es5` (TS1501), and `src/lib/memberMatching.ts` (attendance-import code, a protected area) uses it. Raising the target for this check avoids touching that file. The cost is that es5-only errors (for example `for...of` over a `Map` or `Set`, TS2802) are not reported by `npm run typecheck`; `npm run build` still reports them, and CI runs both. Run both before declaring a change done.

## Edge Functions

`deno check` and `deno test` use Deno directly (CI pins Deno 2.8.2). The tests run without `--allow-net`, with fake keys and `.invalid` URLs, so they cannot reach Supabase, Gemini or GitHub. See `docs/ask-vsa-assistant.md` for what is covered.

The functions import `esm.sh/@supabase/supabase-js@2` (a floating major) and there is no `deno.lock`, so a new upstream release can change what CI checks. If that ever causes a spurious failure, pin the import version rather than loosening the check.
