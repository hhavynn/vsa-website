# Client bundle credential guard (#348)

The GitHub `security` job runs `node --test scripts/check-client-secrets.test.mjs` and `node scripts/check-client-secrets.mjs` on pull requests to main. It inspects tracked client source/assets and committed `.env*` files for unreviewed public variables, high-confidence credential signatures and privileged JWTs in the public anon-key slot. Reports include only the file and issue category, never a secret value.

Allowed names are `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, `REACT_APP_GA4_MEASUREMENT_ID`, `REACT_APP_SUPABASE_IMAGE_TRANSFORMS`, and `REACT_APP_ATTENDANCE_IDENTITY_V2`. Supabase's **anon** key is deliberately public. A new public variable must receive a security review before extending the allowlist; private credentials always belong in server secrets.

This narrow tripwire does not replace GitHub secret scanning or push protection. It does not inspect history, generated bundles, or untracked local env files. If it fires, investigate privately, **rotate any exposed credential before removing it**, update its trusted consumers, then remove it from exposed bundles and repository history through the incident process. Never paste a value into a PR/comment/test fixture.

| Credential | Rotation owner/location | Potential impact |
| --- | --- | --- |
| Supabase service role | Supabase operator / trusted Edge Function and CI secrets | Database and storage privileged operations |
| Gemini / legacy OpenAI key | Vendor billing owner / Supabase Function secrets | Assistant API availability and cost |
| GitHub dispatch token / webhook secret | Repo owner / Supabase Function secrets | Image migration workflows |
| Google Analytics OAuth tokens | Google Cloud owner / Supabase Function secrets | Admin analytics |
| Vercel deployment token | Vercel owner / GitHub Actions secrets | Deployment |

Review downstream services before revocation and redeploy affected public bundles after removal.