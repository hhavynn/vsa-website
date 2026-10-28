import {
  createAnalyticsHandler,
  createImageMigrationHandler,
  type PrivilegedDependencies,
} from "./privileged-handlers.ts";

function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
const id = "00000000-0000-4000-8000-000000000001";
const payload = {
  type: "INSERT",
  table: "events",
  schema: "public",
  record: {
    id,
    image_url:
      "https://abc.supabase.co/storage/v1/object/public/event_images/a.webp",
  },
  old_record: null,
};
function request(body: unknown = payload, secret: string | null = "secret") {
  return new Request("https://functions.invalid", {
    method: "POST",
    headers: secret ? { "x-image-migration-secret": secret } : {},
    body: JSON.stringify(body),
  });
}
function dependencies() {
  const state = { quota: 0, dispatched: 0, analytics: 0 };
  const deps: PrivilegedDependencies = {
    webhookSecret: "secret",
    hashKey: "server-hmac",
    projectUrl: "https://abc.supabase.co",
    authenticateAdmin: async () => ({ userId: id }),
    reserve: async () => {
      state.quota++;
      return true;
    },
    dispatch: async () => {
      state.dispatched++;
      return true;
    },
    analytics: async () => {
      state.analytics++;
      return { summary: {} };
    },
  };
  return { state, deps };
}
Deno.test("webhooks reject missing/wrong credentials before quota or dispatch", async () => {
  const { state, deps } = dependencies();
  const handler = createImageMigrationHandler("events", deps);
  for (const secret of [null, "wrong"]) {
    assert(
      (await handler(request(payload, secret))).status === 401,
      "credentials accepted",
    );
  }
  assert(
    state.quota === 0 && state.dispatched === 0,
    "unauthorized request consumed resources",
  );
});
Deno.test("webhooks validate JSON, size, shape and types before admission", async () => {
  const { state, deps } = dependencies();
  const handler = createImageMigrationHandler("events", deps);
  for (
    const body of [
      null,
      [],
      { ...payload, type: ["INSERT"] },
      { ...payload, extra: true },
      { ...payload, table: "house_events" },
      { ...payload, record: { id: 3, image_url: payload.record.image_url } },
      { ...payload, record: { id, image_url: {} } },
    ]
  ) {
    assert(
      (await handler(request(body))).status === 400,
      "invalid body accepted",
    );
  }
  const malformed = request();
  malformed.headers.set("content-type", "application/json");
  assert(
    (await handler(new Request(malformed, { body: "{" }))).status === 400,
    "malformed JSON accepted",
  );
  assert(
    (await handler(
      request({ ...payload, record: { id, image_url: "x".repeat(20000) } }),
    )).status === 413,
    "oversize accepted",
  );
  assert(
    state.quota === 0 && state.dispatched === 0,
    "invalid body reached resources",
  );
});
Deno.test("valid image webhooks reserve shared global scope before dispatch and fail closed", async () => {
  const { state, deps } = dependencies();
  const scopes: string[] = [];
  deps.reserve = async (scope) => {
    scopes.push(scope);
    return true;
  };
  assert(
    (await createImageMigrationHandler("events", deps)(request())).status ===
      200,
    "valid event rejected",
  );
  assert(
    (await createImageMigrationHandler("house_events", deps)(
      request({ ...payload, table: "house_events" }),
    )).status === 200,
    "valid house rejected",
  );
  assert(
    scopes.join() === "image-migration,image-migration",
    "two endpoints split global budget",
  );
  deps.reserve = async () => false;
  assert(
    (await createImageMigrationHandler("events", deps)(request())).status ===
      429,
    "quota denial accepted",
  );
  deps.reserve = async () => {
    throw new Error("secret internal error");
  };
  const unavailable = await createImageMigrationHandler("events", deps)(
    request(),
  );
  assert(
    unavailable.status === 503 &&
      !(await unavailable.text()).includes("secret"),
    "quota backend leaked error",
  );
  assert(state.dispatched === 2, "denied request dispatched");
});
Deno.test("local, external and unchanged images retain no-op semantics without quota", async () => {
  const { state, deps } = dependencies();
  const handler = createImageMigrationHandler("events", deps);
  for (
    const image_url of [
      null,
      "/images/local.webp",
      "https://example.com/a.webp",
    ]
  ) {
    assert(
      (await handler(request({ ...payload, record: { id, image_url } })))
        .status === 200,
      "no-op failed",
    );
  }
  await handler(
    request({ ...payload, type: "UPDATE", old_record: payload.record }),
  );
  assert(state.dispatched === 0 && state.quota === 0, "no-op consumed budget");
});
Deno.test("analytics rejects unauthenticated/non-admin callers and disallowed origins before quota", async () => {
  const { state, deps } = dependencies();
  const handler = createAnalyticsHandler(deps);
  for (const status of [401, 403] as const) {
    deps.authenticateAdmin = async () => ({ status });
    assert(
      (await handler(request({}))).status === status,
      "unauthorized analytics accepted",
    );
  }
  const req = request({});
  req.headers.set("origin", "https://evil.invalid");
  assert((await handler(req)).status === 403, "bad origin accepted");
  assert(
    state.quota === 0 && state.analytics === 0,
    "unauthorized consumed API quota",
  );
});
Deno.test("analytics validates dates and fields before OAuth or admission", async () => {
  const { state, deps } = dependencies();
  const handler = createAnalyticsHandler(deps);
  for (
    const body of [
      { extra: true },
      { startDate: {} },
      { startDate: "2026-02-30" },
      { startDate: "10000daysAgo" },
      { startDate: "today", endDate: "30daysAgo" },
      [],
    ]
  ) {
    assert(
      (await handler(request(body))).status === 400,
      "invalid analytics accepted",
    );
  }
  assert(
    state.quota === 0 && state.analytics === 0,
    "bad input consumed API quota",
  );
  assert(
    (await handler(request({ startDate: "30daysAgo", endDate: "today" })))
      .status === 200,
    "normal date range rejected",
  );
  deps.reserve = async () => false;
  assert(
    (await handler(request({}))).status === 429 && state.analytics === 1,
    "denied analytics reached Google",
  );
});
