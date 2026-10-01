import { corsHeaders } from "../_shared/cors.ts";

export interface UploadInput {
  matchedMemberId: string;
  submittedName: string;
  submittedEmail: string;
  noteToAdmins: string | null;
  consentConfirmed: true;
  contentType: string;
  size: number;
}
interface UploadDependencies {
  reserve: (input: UploadInput, ipHash: string) => Promise<
    { path: string } | { error: "invalid" | "limit" | "unavailable" }
  >;
  sign: (path: string) => Promise<string | null>;
  hashKey: string;
}
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function parseInput(value: unknown): UploadInput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.matchedMemberId !== "string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v.matchedMemberId)
    || typeof v.submittedName !== "string" || !v.submittedName.trim() || v.submittedName.length > 200
    || typeof v.submittedEmail !== "string" || v.submittedEmail.length > 200 || !/^[^\s@]+@ucsd\.edu$/i.test(v.submittedEmail.trim())
    || v.consentConfirmed !== true || typeof v.contentType !== "string" || !MIME_TYPES.has(v.contentType)
    || typeof v.size !== "number" || !Number.isInteger(v.size) || v.size < 1 || v.size > 5242880
    || (v.noteToAdmins != null && (typeof v.noteToAdmins !== "string" || v.noteToAdmins.length > 1000))) return null;
  return {
    matchedMemberId: v.matchedMemberId,
    submittedName: v.submittedName.trim(), submittedEmail: v.submittedEmail.trim().toLowerCase(),
    noteToAdmins: typeof v.noteToAdmins === "string" ? v.noteToAdmins.trim() || null : null,
    consentConfirmed: true, contentType: v.contentType, size: v.size,
  };
}

async function limitedBody(req: Request): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("No body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) throw new Error("Body too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function createPhotoUploadHandler(deps: UploadDependencies) {
  return async (req: Request): Promise<Response> => {
    const headers = { ...corsHeaders(req, {
      allowedHeaders: "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
    }), "Content-Type": "application/json", "Cache-Control": "no-store" };
    const respond = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers });
    if (req.method === "OPTIONS") return new Response("ok", { headers });
    if (req.method !== "POST") return respond(405, "Use POST to submit a photo request.");
    let input: UploadInput | null;
    try { input = parseInput(await limitedBody(req)); } catch { input = null; }
    if (!input) return respond(400, "Choose a member, confirm consent, and provide a valid UCSD email and JPEG, PNG, or WebP photo up to 5 MB.");
    if (!deps.hashKey) return respond(503, "Photo upload is unavailable. Please try again later.");
    try {
      // This header is best-effort only: global/lifetime quotas remain authoritative
      // even if the gateway forwards a spoofed header. Missing IPs share a budget.
      const candidate = req.headers.get("cf-connecting-ip") ?? "";
      const ip = candidate.length <= 64 && /^[a-f0-9.:]+$/i.test(candidate) ? candidate.toLowerCase() : "unavailable";
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(deps.hashKey),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`member-photo-upload:${ip}`));
      const ipHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      const reservation = await deps.reserve(input, ipHash);
      if ("error" in reservation) {
        if (reservation.error === "limit") return respond(429, "Photo request limit reached. Please contact VSA or try again later.");
        if (reservation.error === "invalid") return respond(400, "Invalid photo request.");
        return respond(503, "Photo upload is unavailable. Please try again later.");
      }
      const token = await deps.sign(reservation.path);
      if (!token) return respond(503, "Photo upload is unavailable. Please try again later.");
      return new Response(JSON.stringify({ path: reservation.path, token }), { headers });
    } catch {
      return respond(503, "Photo upload is unavailable. Please try again later.");
    }
  };
}
