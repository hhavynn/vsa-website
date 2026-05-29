import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Matches Supabase Storage public URLs — same pattern as the migration script.
const SUPABASE_STORAGE_RE = /supabase\.co\/storage\/v1\/object\/public\//;

function isSupabaseStorageUrl(url: string): boolean {
  return SUPABASE_STORAGE_RE.test(url);
}

function isLocalPath(url: string): boolean {
  return url.startsWith("/images/") || url.startsWith("/");
}

interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown> | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  // Only POST accepted — Supabase webhooks always POST.
  if (req.method !== "POST") {
    return json({ triggered: false, reason: "Method not allowed" }, 405);
  }

  // Verify shared secret. Supabase webhook sends this as a custom header.
  const expectedSecret = Deno.env.get("IMAGE_MIGRATION_WEBHOOK_SECRET");
  const receivedSecret = req.headers.get("x-image-migration-secret");
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return json({ triggered: false, reason: "Unauthorized" }, 401);
  }

  // Parse the Supabase Database Webhook payload.
  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ triggered: false, reason: "Invalid JSON payload" }, 400);
  }

  const { type, record, old_record } = payload;

  // Only handle INSERT and UPDATE on events.
  if (type !== "INSERT" && type !== "UPDATE") {
    return json({ triggered: false, reason: `Unsupported operation: ${type}` });
  }

  const eventId = record?.id as string | undefined;
  const newImageUrl = record?.image_url as string | undefined;
  const oldImageUrl = old_record?.image_url as string | undefined;

  if (!eventId) {
    return json({ triggered: false, reason: "Missing event ID" });
  }

  if (!newImageUrl) {
    return json({ triggered: false, reason: "No image URL in payload", event_id: eventId });
  }

  // Already migrated to the repo — nothing to do.
  if (isLocalPath(newImageUrl)) {
    return json({ triggered: false, reason: "Image already at local path", event_id: eventId });
  }

  // Not a Supabase Storage URL — skip external embeds, etc.
  if (!isSupabaseStorageUrl(newImageUrl)) {
    return json({ triggered: false, reason: "Image URL is not Supabase Storage", event_id: eventId });
  }

  // For UPDATE, skip if image URL didn't change (e.g. title/date/location edit).
  if (type === "UPDATE" && oldImageUrl === newImageUrl) {
    return json({ triggered: false, reason: "Image URL unchanged", event_id: eventId });
  }

  // ── Dispatch to GitHub ──────────────────────────────────────────────────────

  const githubRepo = Deno.env.get("GITHUB_REPOSITORY");
  const githubToken = Deno.env.get("GITHUB_DISPATCH_TOKEN");
  const eventType =
    Deno.env.get("GITHUB_DISPATCH_EVENT_TYPE") ?? "event-image-migration-requested";

  if (!githubRepo || !githubToken) {
    console.error("Missing GITHUB_REPOSITORY or GITHUB_DISPATCH_TOKEN env vars");
    return json({ triggered: false, reason: "Server misconfiguration", event_id: eventId }, 500);
  }

  const dispatchUrl = `https://api.github.com/repos/${githubRepo}/dispatches`;
  const dispatchBody = JSON.stringify({
    event_type: eventType,
    client_payload: {
      event_id: eventId,
      image_url: newImageUrl,
      source: "supabase-event-webhook",
    },
  });

  let dispatchRes: Response;
  try {
    dispatchRes = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: dispatchBody,
    });
  } catch (err) {
    console.error("GitHub dispatch network error:", (err as Error).message);
    return json({ triggered: false, reason: "GitHub dispatch failed", event_id: eventId }, 502);
  }

  if (!dispatchRes.ok) {
    // Log status only — avoid logging auth tokens.
    const text = await dispatchRes.text();
    console.error(`GitHub dispatch returned ${dispatchRes.status}: ${text.slice(0, 200)}`);
    return json(
      { triggered: false, reason: `GitHub API error ${dispatchRes.status}`, event_id: eventId },
      502,
    );
  }

  console.log(`Dispatched ${eventType} for event ${eventId} (op: ${type})`);
  return json({ triggered: true, reason: "Dispatched to GitHub", event_id: eventId });
});
