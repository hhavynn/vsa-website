# Client bundle credential guard (#348)

The GitHub `security` job runs `node --test scripts/check-client-secrets.test.mjs` and `node scripts/check-client-secrets.mjs` on pull requests to main. It inspects tracked source and committed `.env*` files for high-confidence credential signatures, privileged JWTs and unreviewed public variables. The build lifecycle additionally checks the actual process environment and CRA production env files, including local files. Reports include only the file and issue category, never a secret value. The source check covers dot, optional-chain, and literal bracket references (for example, `process.env['REACT_APP_*']` and `import.meta.env['REACT_APP_*']`), which must use the same public-key allowlist. Dynamically constructed names cannot be certified by a static name-pattern check; review them manually.

Allowed names are `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, `REACT_APP_GA4_MEASUREMENT_ID`, `REACT_APP_SUPABASE_IMAGE_TRANSFORMS`, `REACT_APP_ATTENDANCE_IDENTITY_V2`, `REACT_APP_SENTRY_DSN`, `REACT_APP_POSTHOG_KEY` and `REACT_APP_POSTHOG_HOST`. A Sentry DSN and a PostHog project key (`phc_`) only allow sending events to one project; both were reviewed in [the observability plan](observability-instrumentation-plan.md). PostHog personal API keys (`phx_`) and Sentry auth tokens (`sntrys_`/`sntryu_`) are flagged as credentials. Supabase's **anon** key is deliberately public. A new public variable must receive a security review before extending the allowlist; private credentials always belong in server secrets. Standard Vercel deployment system variables (`REACT_APP_VERCEL_*`) are recognized in the build environment to support preview deployments without relaxing credential detection.

Public build values must be literal: the build guard rejects dollar signs in them because CRA can expand variables after the guard runs. This narrow tripwire does not inspect history, generated bundles, binary files or test files, and cannot detect every credential. Its build-time mode checks the environment and root production env files; the CI security job separately scans tracked source. It is not proof that a bundle contains no secrets. If it fires, investigate privately, **rotate any exposed credential before removing it**, update its trusted consumers, then remove it from exposed bundles and repository history through the incident process. Never paste a real value into a PR, comment or test fixture.

| Credential | Rotation owner/location | Potential impact |
| --- | --- | --- |
| Supabase service role | Supabase operator / trusted Edge Function and CI secrets | Database and storage privileged operations |
| Gemini / legacy OpenAI key | Vendor billing owner / Supabase Function secrets | Assistant API availability and cost |
| GitHub dispatch token / webhook secret | Repo owner / Supabase Function secrets | Image migration workflows |
| Google Analytics OAuth tokens | Google Cloud owner / Supabase Function secrets | Admin analytics |
| Vercel deployment token | Vercel owner / GitHub Actions secrets | Deployment |
| Sentry organization auth token (`SENTRY_AUTH_TOKEN` or `SENTRY_AUTH_TOKENS`, read only by `scripts/sentry-sourcemaps.mjs` at build time) | Sentry org owner / Vercel build env (Production, Sensitive, never `REACT_APP_*`) | Release and source-map uploads in the Sentry org |

Review downstream services before revocation and redeploy affected public bundles after removal.
