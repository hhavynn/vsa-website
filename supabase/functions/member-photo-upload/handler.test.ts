import { createPhotoUploadHandler, type UploadInput } from "./handler.ts";

const memberId = "00000000-0000-4000-8000-000000000001";
const valid: UploadInput = {
  matchedMemberId: memberId, submittedName: "Member", submittedEmail: "member@ucsd.edu",
  noteToAdmins: null, consentConfirmed: true, contentType: "image/webp", size: 100,
};
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
function request(body: unknown = valid, ip?: string) {
  return new Request("https://example.invalid", { method: "POST",
    headers: ip ? { "cf-connecting-ip": ip } : {}, body: JSON.stringify(body) });
}
Deno.test("invalid boundary input never reserves quota or signs storage", async () => {
  let calls = 0;
  const handler = createPhotoUploadHandler({ hashKey: "server-secret",
    reserve: async () => { calls++; return { path: "pending/x.webp" }; },
    sign: async () => { calls++; return "token"; },
  });
  for (const changes of [{ consentConfirmed: false }, { matchedMemberId: "../bad" },
    { size: 5242881 }, { size: -1 }, { size: 1.5 }, { contentType: "image/gif" },
    { submittedEmail: "member@example.com" }, { noteToAdmins: "x".repeat(1001) }]) {
    assert((await handler(request({ ...valid, ...changes }))).status === 400, "invalid input accepted");
  }
  assert(calls === 0, "invalid input reached quota or signer");
});
Deno.test("quota denial and backend failure never produce an upload capability", async () => {
  let signed = 0;
  for (const error of ["limit", "unavailable", "invalid"] as const) {
    const handler = createPhotoUploadHandler({ hashKey: "secret", reserve: async () => ({ error }),
      sign: async () => { signed++; return "token"; } });
    const response = await handler(request());
    assert(response.status === (error === "limit" ? 429 : error === "invalid" ? 400 : 503), "wrong failure status");
    assert(!(await response.text()).includes("token"), "failure leaked token");
  }
  assert(signed === 0, "denied reservation reached signer");
});
Deno.test("reservation precedes signing and persists only HMAC identity", async () => {
  const calls: string[] = [];
  let hash = "";
  const handler = createPhotoUploadHandler({ hashKey: "secret",
    reserve: async (_input, ipHash) => { calls.push("reserve"); hash = ipHash; return { path: "pending/x.webp" }; },
    sign: async (path) => { calls.push(`sign:${path}`); return "one-object-token"; } });
  const response = await handler(request(valid, "203.0.113.4"));
  assert(response.status === 200, "valid request failed");
  assert(calls.join(",") === "reserve,sign:pending/x.webp", "storage signed before quota reservation");
  assert(/^[a-f0-9]{64}$/.test(hash) && !hash.includes("203.0.113.4"), "raw IP persisted");
  assert(response.headers.get("cache-control") === "no-store", "capability may be cached");
});
Deno.test("missing or malformed IPs share one quota identity; XFF is ignored", async () => {
  const hashes: string[] = [];
  const handler = createPhotoUploadHandler({ hashKey: "secret",
    reserve: async (_input, hash) => { hashes.push(hash); return { path: "pending/x.webp" }; }, sign: async () => "token" });
  await handler(request());
  await handler(request(valid, "garbage"));
  const spoofed = request(); spoofed.headers.set("x-forwarded-for", "1.2.3.4");
  await handler(spoofed);
  assert(hashes.length === 3 && new Set(hashes).size === 1, "untrusted IP created extra identities");
});
Deno.test("failed signing fails closed after consuming the reservation", async () => {
  let reserved = 0;
  const handler = createPhotoUploadHandler({ hashKey: "secret",
    reserve: async () => { reserved++; return { path: "pending/x.webp" }; }, sign: async () => null });
  assert((await handler(request())).status === 503 && reserved === 1, "signing failure bypassed reservation");
});
Deno.test("bounded body rejects oversized metadata without side effects", async () => {
  let reserved = 0;
  const handler = createPhotoUploadHandler({ hashKey: "secret",
    reserve: async () => { reserved++; return { path: "pending/x.webp" }; }, sign: async () => "token" });
  assert((await handler(request({ ...valid, extra: "x".repeat(9000) }))).status === 400, "oversize body accepted");
  assert(reserved === 0, "oversize body consumed quota");
});
