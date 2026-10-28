import { createPrivilegedRuntime, quotaLimits } from "./privileged-runtime.ts";
import { createAnalyticsHandler } from "./privileged-handlers.ts";
import { loadAnalytics } from "./privileged-analytics.ts";

function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
const userId = "00000000-0000-4000-8000-000000000001";
const values: Record<string, string> = {
  SUPABASE_URL: "https://quota.invalid",
  SUPABASE_ANON_KEY: "test-anon",
  SUPABASE_SERVICE_ROLE_KEY: "test-service",
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
  GOOGLE_REFRESH_TOKEN: "test-refresh",
  GA4_PROPERTY_ID: "12345",
};
async function isolated(body: () => Promise<void>) {
  const names = [
    ...Object.keys(values),
    "IMAGE_MIGRATION_CALLER_PER_MINUTE",
    "IMAGE_MIGRATION_GLOBAL_PER_DAY",
    "ANALYTICS_CALLER_PER_MINUTE",
    "ANALYTICS_GLOBAL_PER_DAY",
  ];
  const saved = new Map(names.map((name) => [name, Deno.env.get(name)]));
  const originalFetch = globalThis.fetch;
  try {
    for (const name of names) Deno.env.delete(name);
    for (const [name, value] of Object.entries(values)) {
      Deno.env.set(name, value);
    }
    await body();
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of saved) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function request() {
  return new Request("https://functions.invalid", {
    method: "POST",
    headers: { Authorization: "Bearer test-user-jwt" },
    body: "{}",
  });
}
const user = {
  id: userId,
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
};

Deno.test("real admin helper verifies identity and caller-bound database authorization before quota or Google", async () => {
  await isolated(async () => {
    for (
      const failure of ["invalid-token", "ordinary-user", "database-failure"]
    ) {
      const calls: string[] = [];
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        calls.push(url);
        assert(
          new Headers(init?.headers).get("Authorization") ===
            "Bearer test-user-jwt",
          "identity not forwarded",
        );
        if (url.endsWith("/auth/v1/user")) {
          return failure === "invalid-token"
            ? json({ msg: "Invalid JWT" }, 401)
            : json(user);
        }
        if (url.endsWith("/rest/v1/rpc/is_admin_user")) {
          assert(
            JSON.parse(String(init?.body)).p_user_id === userId,
            "admin helper not caller-bound",
          );
          return failure === "database-failure"
            ? json({ message: "private details" }, 500)
            : json(false);
        }
        throw new Error("unauthorized caller reached external quota");
      };
      const response = await createAnalyticsHandler({
        ...createPrivilegedRuntime(),
        analytics: loadAnalytics,
      })(request());
      assert(
        response.status === (failure === "invalid-token" ? 401 : 403),
        "unauthorized runtime accepted",
      );
      assert(
        calls.every((url) => /auth\/v1\/user|rpc\/is_admin_user/.test(url)),
        "Google or quota called before authorization",
      );
    }
  });
});
Deno.test("authorized analytics reserves quota before OAuth and keeps the report response contract", async () => {
  await isolated(async () => {
    const calls: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/auth/v1/user")) return json(user);
      if (url.endsWith("/rpc/is_admin_user")) return json(true);
      if (url.endsWith("/rpc/reserve_privileged_edge_quota")) {
        const payload = JSON.parse(String(init?.body));
        assert(
          payload.p_scope === "analytics" && payload.p_global_per_day === 500 &&
            payload.p_caller_per_minute === 12,
          "runtime quota defaults lost",
        );
        assert(
          /^[a-f0-9]{64}$/.test(payload.p_caller_hash) &&
            !String(init?.body).includes(userId),
          "raw caller id sent to limiter",
        );
        return json(true);
      }
      if (url === "https://oauth2.googleapis.com/token") {
        return json({ access_token: "test-google-token" });
      }
      if (url.includes("analyticsdata.googleapis.com")) {
        const report = JSON.parse(String(init?.body));
        assert(
          report.dateRanges[0].startDate === "30daysAgo",
          "requested dates changed",
        );
        return report.dimensions[0].name === "date"
          ? json({
            rows: [{
              dimensionValues: [{ value: "20261026" }],
              metricValues: [3, 4, 5, 2].map((n) => ({ value: String(n) })),
            }],
          })
          : json({
            rows: [{
              dimensionValues: [{ value: "/events" }],
              metricValues: [{ value: "5" }],
            }],
          });
      }
      throw new Error("Unexpected upstream request");
    };
    const response = await createAnalyticsHandler({
      ...createPrivilegedRuntime(),
      analytics: loadAnalytics,
    })(request());
    assert(response.status === 200, "authorized report failed");
    const body = await response.json();
    assert(
      body.summary.users === 3 && body.summary.sessions === 4 &&
        body.trend[0].pageViews === 5 && body.topPages[0].path === "/events",
      "report contract changed",
    );
    assert(
      calls[2].endsWith("/reserve_privileged_edge_quota") &&
        calls[3] === "https://oauth2.googleapis.com/token",
      "upstream called before admission",
    );
  });
});
Deno.test("Google upstream errors are controlled and never echo OAuth/provider details", async () => {
  await isolated(async () => {
    globalThis.fetch = async () =>
      json({ error: "test-secret private upstream failure" }, 400);
    const response = await createAnalyticsHandler({
      ...createPrivilegedRuntime(),
      authenticateAdmin: async () => ({ userId }),
      reserve: async () => true,
      analytics: loadAnalytics,
    })(request());
    const body = await response.text();
    assert(
      response.status === 502 && !body.includes("test-secret") &&
        !body.includes("private"),
      "provider details leaked",
    );
  });
});
Deno.test("quota configuration rejects invalid or unbounded limits", async () => {
  await isolated(async () => {
    assert(
      quotaLimits("image-migration").day === 50,
      "image global default changed",
    );
    for (const value of ["0", "10001", "invalid", "-1"]) {
      Deno.env.set("IMAGE_MIGRATION_GLOBAL_PER_DAY", value);
      let rejected = false;
      try {
        quotaLimits("image-migration");
      } catch {
        rejected = true;
      }
      assert(rejected, "invalid daily ceiling accepted");
    }
  });
});
