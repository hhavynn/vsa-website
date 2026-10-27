import {
  createFeedbackHandler,
  type FeedbackDependencies,
  type FeedbackInput,
} from "./handler.ts";

function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
const valid = {
  type: "bug",
  title: " Problem ",
  description: " Details ",
  name: "",
  email: "",
};
const userId = "00000000-0000-4000-8000-000000000001";
function request(body: unknown = valid) {
  return new Request("https://example.invalid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function fixture(overrides: Partial<FeedbackDependencies> = {}) {
  const submissions: Array<{ input: FeedbackInput; userId: string | null }> =
    [];
  const handler = createFeedbackHandler({
    authenticate: async () => ({ userId: null }),
    submit: async (input, identity) => {
      submissions.push({ input, userId: identity });
      return "ok";
    },
    ...overrides,
  });
  return { handler, submissions };
}

Deno.test(
  "anonymous feedback is normalized, has no identity, and returns no private row",
  async () => {
    const { handler, submissions } = fixture();
    const response = await handler(request());
    assert(response.status === 200, "valid anonymous submission rejected");
    assert(
      JSON.stringify(submissions) ===
        JSON.stringify([
          {
            input: {
              type: "bug",
              title: "Problem",
              description: "Details",
              name: null,
              email: null,
            },
            userId: null,
          },
        ]),
      "wrong persisted fields",
    );
    assert(
      (await response.text()) === '{"success":true}',
      "response disclosed stored data",
    );
    assert(
      response.headers.get("cache-control") === "no-store",
      "private response cacheable",
    );
  },
);
Deno.test(
  "authenticated identity comes only from verified authentication",
  async () => {
    const { handler, submissions } = fixture({
      authenticate: async () => ({ userId }),
    });
    assert(
      (await handler(request())).status === 200 &&
        submissions[0]?.userId === userId,
      "verified identity lost",
    );
  },
);
Deno.test(
  "spoofed user_id and arbitrary identity metadata are rejected before persistence",
  async () => {
    const { handler, submissions } = fixture();
    for (const extra of [
      { user_id: userId },
      { status: "resolved" },
      { created_at: "now" },
      { id: userId },
    ]) {
      assert(
        (await handler(request({ ...valid, ...extra }))).status === 400,
        "unexpected field accepted",
      );
    }
    assert(submissions.length === 0, "spoofed submission persisted");
  },
);
Deno.test("invalid fields are rejected before persistence", async () => {
  const { handler, submissions } = fixture();
  for (const body of [
    null,
    [],
    {},
    { ...valid, type: "invalid" },
    { ...valid, title: " " },
    { ...valid, title: "x".repeat(101) },
    { ...valid, description: "" },
    { ...valid, description: "x".repeat(1001) },
    { ...valid, name: 12 },
    { ...valid, name: "x".repeat(101) },
    { ...valid, email: "bad" },
    { ...valid, email: `${"x".repeat(250)}@example.com` },
    { ...valid, description: false },
  ]) {
    assert(
      (await handler(request(body))).status === 400,
      `invalid body accepted: ${JSON.stringify(body).slice(0, 80)}`,
    );
  }
  assert(submissions.length === 0, "invalid payload persisted");
});
Deno.test(
  "malformed JSON, oversized streamed body and wrong content type have controlled failures",
  async () => {
    const { handler, submissions } = fixture();
    for (const [body, status] of [
      ["{", 400],
      ["x".repeat(8193), 413],
    ] as const) {
      const req = request();
      const invalid = new Request(req.url, {
        method: "POST",
        headers: req.headers,
        body,
      });
      assert(
        (await handler(invalid)).status === status,
        "wrong malformed/body limit response",
      );
    }
    const wrongType = request();
    wrongType.headers.set("content-type", "text/plain");
    assert(
      (await handler(wrongType)).status === 415,
      "wrong content type accepted",
    );
    assert(submissions.length === 0, "malformed input persisted");
  },
);
Deno.test("invalid authentication never downgrades to anonymous", async () => {
  const { handler, submissions } = fixture({ authenticate: async () => null });
  assert(
    (await handler(request())).status === 401 && submissions.length === 0,
    "invalid auth admitted",
  );
});
Deno.test(
  "quota failures return predictable 429 and do not report success",
  async () => {
    const { handler } = fixture({ submit: async () => "limit" });
    const response = await handler(request());
    assert(
      response.status === 429 && response.headers.get("retry-after") === "3600",
      "missing quota response",
    );
    assert(
      !(await response.text()).includes("success"),
      "quota rejection reported success",
    );
  },
);
Deno.test(
  "backend errors are bounded and do not expose internals",
  async () => {
    for (const overrides of [
      {
        submit: async () => {
          throw new Error("secret database details");
        },
      },
      { submit: async () => "unavailable" as const },
      {
        authenticate: async () => {
          throw new Error("secret token");
        },
      },
    ]) {
      const { handler } = fixture(overrides);
      const response = await handler(request());
      assert(
        response.status === 503 && !(await response.text()).includes("secret"),
        "internal failure leaked",
      );
    }
  },
);
Deno.test("only POST submits; public reads never return feedback", async () => {
  const { handler, submissions } = fixture();
  for (const method of ["GET", "PUT", "DELETE"]) {
    assert(
      (await handler(new Request("https://example.invalid", { method })))
        .status === 405,
      "method admitted",
    );
  }
  assert(
    (
      await handler(
        new Request("https://example.invalid", { method: "OPTIONS" }),
      )
    ).status === 200,
    "preflight failed",
  );
  assert(submissions.length === 0, "non-POST submitted feedback");
});
