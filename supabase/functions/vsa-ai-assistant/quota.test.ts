import { handler } from "./server-test-adapter.ts";
import "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const uuid = "00000000-0000-4000-8000-000000000001";
const originalFetch = globalThis.fetch;
Deno.env.set("SUPABASE_URL", "https://quota-test.invalid");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
Deno.env.set("GEMINI_API_KEY", "test-provider-key");
Deno.env.set("VSA_AI_ASSISTANT_ENABLED", "true");

function request() {
  return new Request(
    "https://quota-test.invalid/functions/v1/vsa-ai-assistant",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "192.0.2.1",
      },
      body: JSON.stringify({
        sessionId: "session-for-quota-test",
        message: "How do I join VSA?",
      }),
    },
  );
}

function fakeBackend(
  options: {
    blocked?: string;
    reserveError?: boolean;
    providerError?: boolean;
    completeError?: boolean;
    malformed?: boolean;
    noKnowledge?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const completions: Record<string, unknown>[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const name = url.includes("generativelanguage")
      ? "provider"
      : url.split("/").pop()!.split("?")[0];
    calls.push(name);
    let data: unknown = [];
    let status = 200;
    if (name === "reserve_ai_quota") {
      data = options.reserveError ? { message: "database unavailable" } : {
        reservation_id: options.blocked
          ? null
          : (options.malformed ? "invalid-reservation" : uuid),
        blocked_reason: options.blocked ?? null,
      };
      if (options.reserveError) status = 503;
    } else if (name === "match_ai_knowledge_base") {
      data = options.noKnowledge ? [] : [{
        id: uuid,
        title: "Join VSA",
        content: "Attend public events.",
        category: "general",
        source_url: "/get-involved",
      }];
    } else if (name === "provider") {
      data = options.providerError ? { error: "unavailable" } : {
        candidates: [{
          content: { parts: [{ text: "Attend a public event." }] },
        }],
      };
      if (options.providerError) status = 503;
      assert(
        init?.signal instanceof AbortSignal,
        "Provider request must have a deadline",
      );
    } else if (name === "complete_ai_quota") {
      completions.push(JSON.parse(String(init?.body)));
      data = options.completeError
        ? { message: "completion unavailable" }
        : null;
      if (options.completeError) status = 503;
    }
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { calls, completions };
}

Deno.test("reserves quota before retrieval/provider and completes the same reservation", async () => {
  const backend = fakeBackend();
  try {
    const response = await handler(request());
    assert(response.status === 200, "Expected answered response");
    assert(
      backend.calls[0] === "reserve_ai_quota",
      "First backend operation must atomically reserve quota",
    );
    assert(
      backend.calls.indexOf("provider") >
        backend.calls.indexOf("reserve_ai_quota"),
      "Provider must follow admission",
    );
    assert(
      backend.completions.length === 1 &&
        backend.completions[0].p_reservation_id === uuid,
      "Must complete admitted reservation once",
    );
    assert(
      backend.completions[0].p_status === "answered",
      "Must record answered outcome",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("quota denial returns 429 without retrieval or provider calls", async () => {
  const backend = fakeBackend({ blocked: "session_5_minute_limit" });
  try {
    const response = await handler(request());
    assert(response.status === 429, "Expected quota rejection");
    assert(
      !backend.calls.includes("provider") &&
        !backend.calls.includes("match_ai_knowledge_base"),
      "Denied request must do no provider/retrieval work",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("reservation failure fails closed before provider work", async () => {
  const backend = fakeBackend({ reserveError: true });
  try {
    const response = await handler(request());
    assert(response.status === 500, "Backend failure must be unavailable");
    assert(
      !backend.calls.includes("provider"),
      "Failed admission must never call provider",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("provider failure completes consumed reservation as error", async () => {
  const backend = fakeBackend({ providerError: true });
  try {
    const response = await handler(request());
    assert(response.status === 500, "Provider failure must be unavailable");
    assert(
      backend.completions.length === 1 &&
        backend.completions[0].p_status === "error",
      "Failed provider attempt remains consumed and records error",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("completion failure does not return a successful answer or refund admission", async () => {
  const backend = fakeBackend({ completeError: true });
  try {
    const response = await handler(request());
    assert(
      response.status === 500,
      "Completion backend failure must fail closed",
    );
    assert(
      backend.calls.filter((call) => call === "reserve_ai_quota").length === 1,
      "Must never re-admit/refund on logging failure",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("malformed admission fails closed before provider work", async () => {
  const backend = fakeBackend({ malformed: true });
  try {
    const response = await handler(request());
    assert(
      response.status === 500,
      "Malformed quota result must be unavailable",
    );
    assert(
      !backend.calls.includes("provider"),
      "Malformed admission must never call provider",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("global quota denial uses existing 429 status without provider work", async () => {
  const backend = fakeBackend({ blocked: "global_hourly_limit" });
  try {
    const response = await handler(request());
    assert(response.status === 429, "Global budget must reject admission");
    assert(
      !backend.calls.includes("provider"),
      "No provider call after global denial",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("no approved context completes reservation as fallback without provider work", async () => {
  const backend = fakeBackend({ noKnowledge: true });
  try {
    const response = await handler(request());
    assert(response.status === 200, "Expected friendly fallback");
    assert(
      !backend.calls.includes("provider"),
      "Ungrounded request must never call provider",
    );
    assert(
      backend.completions.length === 1 &&
        backend.completions[0].p_status === "fallback",
      "Fallback must consume admitted reservation",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
