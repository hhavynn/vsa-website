// Shared contract tests for the two image-migration webhook functions (#296,
// #229): trigger-event-image-migration and trigger-house-event-image-migration.
//
// Both are Supabase Database Webhook receivers that run with no JWT, so the
// shared-secret header is their only authorization. Every case here either
// proves a request is refused before it can cause a GitHub dispatch, or pins
// what a legitimate request dispatches. `fetch` is replaced, so nothing reaches
// GitHub, and no real token appears in any fixture.
//
// Each function file registers its handler by calling `serve()` at import time,
// so each function's test file runs this contract in its own isolate (`deno
// test` runs files in separate workers).

type Handler = (request: Request) => Promise<Response>;

export interface WebhookContract {
  /** Shown in test names. */
  label: string;
  handler: Handler;
  /** Field the response uses for the record id: event_id or house_event_id. */
  idField: "event_id" | "house_event_id";
  /** repository_dispatch event_type used when no override env var is set. */
  defaultEventType: string;
  /** Env var that overrides the event type. */
  eventTypeEnv: string;
}

const SECRET = "test-webhook-secret";
const GITHUB_TOKEN = "ghp_test_token_not_real";
const SUPABASE_URL =
  "https://example.supabase.co/storage/v1/object/public/event-images/flyer.png";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

interface Dispatch {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

/** Runs `body` with env and fetch isolated; restores both afterwards. */
async function withEnvironment(
  env: Record<string, string | undefined>,
  githubResponse: () => Response | Promise<Response>,
  body: (dispatches: Dispatch[]) => Promise<void>,
) {
  const keys = [
    "IMAGE_MIGRATION_WEBHOOK_SECRET",
    "GITHUB_REPOSITORY",
    "GITHUB_DISPATCH_TOKEN",
    "GITHUB_DISPATCH_EVENT_TYPE",
    "GITHUB_DISPATCH_EVENT_TYPE_HOUSE",
  ];
  const previous = new Map(keys.map((key) => [key, Deno.env.get(key)]));
  for (const key of keys) Deno.env.delete(key);
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) Deno.env.set(key, value);
  }

  const dispatches: Dispatch[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    dispatches.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body ?? "{}")),
    });
    return await githubResponse();
  };
  const originalError = console.error;
  console.error = () => undefined;

  try {
    await body(dispatches);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    for (const [key, value] of previous) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}

const configured = {
  IMAGE_MIGRATION_WEBHOOK_SECRET: SECRET,
  GITHUB_REPOSITORY: "example-org/example-repo",
  GITHUB_DISPATCH_TOKEN: GITHUB_TOKEN,
};

function webhookRequest(
  payload: unknown,
  headers: Record<string, string> = { "x-image-migration-secret": SECRET },
  method = "POST",
) {
  return new Request("https://webhook-test.invalid/", {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: method === "POST" ? (typeof payload === "string" ? payload : JSON.stringify(payload)) : undefined,
  });
}

const ok = () => new Response(null, { status: 204 });

export function defineImageMigrationWebhookTests(contract: WebhookContract) {
  const { label, handler, idField, defaultEventType, eventTypeEnv } = contract;
  const insert = (imageUrl: string | undefined, extra: Record<string, unknown> = {}) => ({
    type: "INSERT",
    record: { id: "record-1", image_url: imageUrl, ...extra },
    old_record: null,
  });

  Deno.test(`${label}: rejects non-POST methods`, async () => {
    await withEnvironment(configured, ok, async (dispatches) => {
      const response = await handler(webhookRequest(null, {}, "GET"));
      assert(response.status === 405, `Expected 405, got ${response.status}`);
      assert(dispatches.length === 0, "No dispatch for a GET");
    });
  });

  Deno.test(`${label}: refuses a missing, wrong, or empty secret before any dispatch`, async () => {
    await withEnvironment(configured, ok, async (dispatches) => {
      const attempts: Record<string, string>[] = [
        {},
        { "x-image-migration-secret": "wrong" },
        { "x-image-migration-secret": "" },
        { "x-image-migration-secret": SECRET.toUpperCase() },
        { authorization: `Bearer ${SECRET}` },
      ];
      for (const headers of attempts) {
        const response = await handler(webhookRequest(insert(SUPABASE_URL), headers));
        assert(response.status === 401, `Expected 401 for ${JSON.stringify(headers)}, got ${response.status}`);
        const json = await response.json();
        assert(json.triggered === false, "A refused request must not report triggered");
      }
      assert(dispatches.length === 0, "No request may reach GitHub without the secret");
    });
  });

  Deno.test(`${label}: fails closed when no secret is configured`, async () => {
    // A server with no IMAGE_MIGRATION_WEBHOOK_SECRET must refuse everything,
    // including a request that sends no header (undefined must not equal null).
    await withEnvironment(
      { GITHUB_REPOSITORY: "example-org/example-repo", GITHUB_DISPATCH_TOKEN: GITHUB_TOKEN },
      ok,
      async (dispatches) => {
        const attempts: Record<string, string>[] = [
          {},
          { "x-image-migration-secret": "" },
          { "x-image-migration-secret": "anything" },
        ];
        for (const headers of attempts) {
          const response = await handler(webhookRequest(insert(SUPABASE_URL), headers));
          assert(response.status === 401, `Expected 401, got ${response.status}`);
        }
        assert(dispatches.length === 0, "No dispatch when the secret is unset");
      },
    );
  });

  Deno.test(`${label}: authorizes before reading the body`, async () => {
    await withEnvironment(configured, ok, async () => {
      const response = await handler(webhookRequest("{not json", { "x-image-migration-secret": "wrong" }));
      assert(response.status === 401, "An unauthenticated caller must not learn the body was invalid");
    });
  });

  Deno.test(`${label}: rejects an authorized but malformed body`, async () => {
    await withEnvironment(configured, ok, async (dispatches) => {
      const response = await handler(webhookRequest("{not json"));
      assert(response.status === 400, `Expected 400, got ${response.status}`);
      assert(dispatches.length === 0, "No dispatch for an invalid body");
    });
  });

  Deno.test(`${label}: ignores payloads that need no migration`, async () => {
    const skipped: Array<[string, unknown]> = [
      ["DELETE operation", { type: "DELETE", record: { id: "r1", image_url: SUPABASE_URL } }],
      ["missing id", { type: "INSERT", record: { image_url: SUPABASE_URL } }],
      ["no image url", insert(undefined)],
      ["local /images path", insert("/images/events/flyer.png")],
      ["external (non-Supabase) url", insert("https://cdn.example.com/flyer.png")],
      [
        "unchanged image on update",
        {
          type: "UPDATE",
          record: { id: "r1", image_url: SUPABASE_URL },
          old_record: { id: "r1", image_url: SUPABASE_URL },
        },
      ],
    ];
    await withEnvironment(configured, ok, async (dispatches) => {
      for (const [name, payload] of skipped) {
        const response = await handler(webhookRequest(payload));
        assert(response.status === 200, `${name}: expected 200, got ${response.status}`);
        const json = await response.json();
        assert(json.triggered === false, `${name}: must not trigger`);
      }
      assert(dispatches.length === 0, "None of these may dispatch to GitHub");
    });
  });

  Deno.test(`${label}: dispatches a new Supabase Storage image to GitHub`, async () => {
    await withEnvironment(configured, ok, async (dispatches) => {
      const response = await handler(webhookRequest(insert(SUPABASE_URL)));
      const json = await response.json();
      assert(response.status === 200 && json.triggered === true, "Expected a triggered dispatch");
      assert(json[idField] === "record-1", `Response must carry ${idField}`);

      assert(dispatches.length === 1, "Exactly one dispatch");
      const [dispatch] = dispatches;
      assertEquals(dispatch.url, "https://api.github.com/repos/example-org/example-repo/dispatches", "dispatch url");
      assert(dispatch.headers.get("authorization") === `Bearer ${GITHUB_TOKEN}`, "Bearer token sent to GitHub");
      assert(dispatch.body.event_type === defaultEventType, `event_type defaults to ${defaultEventType}`);
      const payload = dispatch.body.client_payload as Record<string, unknown>;
      assert(payload.image_url === SUPABASE_URL, "client_payload carries the image url");
      assert(!JSON.stringify(response).includes(GITHUB_TOKEN), "Token is never in the response");
      assert(!JSON.stringify(json).includes(GITHUB_TOKEN), "Token is never in the response body");
    });
  });

  Deno.test(`${label}: dispatches when an update changes the image`, async () => {
    await withEnvironment(configured, ok, async (dispatches) => {
      const response = await handler(
        webhookRequest({
          type: "UPDATE",
          record: { id: "r1", image_url: SUPABASE_URL },
          old_record: { id: "r1", image_url: "https://example.supabase.co/storage/v1/object/public/event-images/old.png" },
        }),
      );
      assert((await response.json()).triggered === true, "A changed image must dispatch");
      assert(dispatches.length === 1, "Exactly one dispatch");
    });
  });

  Deno.test(`${label}: honours the event-type override`, async () => {
    await withEnvironment({ ...configured, [eventTypeEnv]: "custom-event-type" }, ok, async (dispatches) => {
      await handler(webhookRequest(insert(SUPABASE_URL)));
      assert(dispatches[0].body.event_type === "custom-event-type", "Override is used");
    });
  });

  Deno.test(`${label}: reports server misconfiguration without dispatching`, async () => {
    for (const missing of ["GITHUB_REPOSITORY", "GITHUB_DISPATCH_TOKEN"]) {
      const env: Record<string, string | undefined> = { ...configured, [missing]: undefined };
      await withEnvironment(env, ok, async (dispatches) => {
        const response = await handler(webhookRequest(insert(SUPABASE_URL)));
        assert(response.status === 500, `${missing} unset: expected 500, got ${response.status}`);
        assert(dispatches.length === 0, "No dispatch when misconfigured");
      });
    }
  });

  Deno.test(`${label}: maps GitHub failures to 502 without leaking the token`, async () => {
    await withEnvironment(
      configured,
      () => new Response(`bad credentials for ${GITHUB_TOKEN}`, { status: 401 }),
      async () => {
        const response = await handler(webhookRequest(insert(SUPABASE_URL)));
        const text = await response.text();
        assert(response.status === 502, `Expected 502, got ${response.status}`);
        assert(text.includes("GitHub API error 401"), "Reports the upstream status");
        assert(!text.includes(GITHUB_TOKEN), "Upstream body (and token) must not be echoed");
      },
    );

    await withEnvironment(
      configured,
      () => Promise.reject(new TypeError("network down")),
      async () => {
        const response = await handler(webhookRequest(insert(SUPABASE_URL)));
        assert(response.status === 502, `Expected 502 on network failure, got ${response.status}`);
        assert((await response.json()).triggered === false, "A failed dispatch is not triggered");
      },
    );
  });
}
