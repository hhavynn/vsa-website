import { allowedOrigins, corsHeaders } from "./cors.ts";

export class BoundaryError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = "INVALID_REQUEST",
  ) {
    super(message);
  }
}
type AdminIdentity = { userId: string } | { status: 401 | 403 };
export interface PrivilegedDependencies {
  webhookSecret: string;
  hashKey: string;
  projectUrl: string;
  authenticateAdmin(req: Request): Promise<AdminIdentity>;
  reserve(
    scope: "image-migration" | "analytics",
    caller: string,
  ): Promise<boolean>;
  dispatch(
    table: "events" | "house_events",
    id: string,
    imageUrl: string,
  ): Promise<boolean>;
  analytics(
    startDate: string,
    endDate: string,
  ): Promise<Record<string, unknown>>;
}
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function json(req: Request, body: unknown, status = 200, cors = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(cors ? corsHeaders(req) : {}),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(status === 429 ? { "Retry-After": "60" } : {}),
    },
  });
}
export async function boundedJson(
  req: Request,
  maxBytes: number,
): Promise<unknown> {
  const length = req.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes))
    throw new BoundaryError("Request body too large", 413);
  if (!req.body) throw new BoundaryError("Invalid JSON payload", 400);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new BoundaryError("Request body too large", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof BoundaryError) throw error;
    throw new BoundaryError("Invalid JSON payload", 400);
  } finally {
    reader.releaseLock();
  }
}
async function callerHash(key: string, identity: string) {
  if (!key)
    throw new BoundaryError("Service unavailable", 503, "SERVICE_UNAVAILABLE");
  const hmac = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    hmac,
    new TextEncoder().encode(identity),
  );
  return Array.from(new Uint8Array(signature), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}
async function constantTimeEqual(actual: string | null, expected: string) {
  if (!actual || !expected || actual.length > 4096) return false;
  const digest = async (value: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    );
  const [left, right] = await Promise.all([digest(actual), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
function failure(req: Request, error: unknown, cors = false) {
  const known =
    error instanceof BoundaryError
      ? error
      : new BoundaryError("Service unavailable", 503, "SERVICE_UNAVAILABLE");
  return json(
    req,
    { error: known.message, code: known.code, triggered: false },
    known.status,
    cors,
  );
}
export function createImageMigrationHandler(
  table: "events" | "house_events",
  deps: PrivilegedDependencies,
) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST")
        throw new BoundaryError(
          "Method not allowed",
          405,
          "METHOD_NOT_ALLOWED",
        );
      if (
        !(await constantTimeEqual(
          req.headers.get("x-image-migration-secret"),
          deps.webhookSecret,
        ))
      )
        throw new BoundaryError("Unauthorized", 401, "UNAUTHORIZED");
      const input = await boundedJson(req, 16384);
      if (
        !isObject(input) ||
        Object.keys(input).some(
          (key) =>
            !["type", "table", "schema", "record", "old_record"].includes(key),
        ) ||
        typeof input.type !== "string" ||
        !["INSERT", "UPDATE"].includes(input.type) ||
        input.table !== table ||
        input.schema !== "public" ||
        !isObject(input.record) ||
        (input.old_record !== null &&
          input.old_record !== undefined &&
          !isObject(input.old_record))
      )
        throw new BoundaryError("Invalid webhook payload", 400);
      const id = input.record.id;
      const image = input.record.image_url;
      const oldImage = isObject(input.old_record)
        ? input.old_record.image_url
        : null;
      if (
        typeof id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        ) ||
        (image !== null &&
          image !== undefined &&
          (typeof image !== "string" || image.length > 2048)) ||
        (oldImage !== null &&
          oldImage !== undefined &&
          (typeof oldImage !== "string" || oldImage.length > 2048))
      )
        throw new BoundaryError("Invalid webhook record", 400);
      const identity =
        table === "events" ? { event_id: id } : { house_event_id: id };
      const skip = (reason: string) =>
        json(req, { triggered: false, reason, ...identity });
      if (typeof image !== "string" || !image)
        return skip("No image URL in payload");
      if (image.startsWith("/")) return skip("Image already at local path");
      let imageUrl: URL;
      try {
        imageUrl = new URL(image);
      } catch {
        throw new BoundaryError("Invalid image URL", 400);
      }
      if (
        imageUrl.protocol !== "https:" ||
        imageUrl.origin !== new URL(deps.projectUrl).origin ||
        !imageUrl.pathname.startsWith("/storage/v1/object/public/")
      )
        return skip("Image URL is not project Supabase Storage");
      if (input.type === "UPDATE" && oldImage === image)
        return skip("Image URL unchanged");
      if (
        !(await deps.reserve(
          "image-migration",
          await callerHash(deps.hashKey, "image-migration-webhook"),
        ))
      )
        throw new BoundaryError("Dispatch limit reached", 429, "RATE_LIMITED");
      if (!(await deps.dispatch(table, id, image)))
        throw new BoundaryError(
          "GitHub dispatch failed",
          502,
          "UPSTREAM_ERROR",
        );
      return json(req, {
        triggered: true,
        reason: "Dispatched to GitHub",
        ...identity,
      });
    } catch (error) {
      return failure(req, error);
    }
  };
}
function parseDate(value: unknown): { text: string; time: number } {
  if (typeof value !== "string" || value.length > 10)
    throw new BoundaryError("Invalid date range", 400);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (value === "today") return { text: value, time: today.getTime() };
  if (value === "yesterday")
    return { text: value, time: today.getTime() - 86400000 };
  const relative = /^(\d{1,3})daysAgo$/.exec(value);
  if (relative && Number(relative[1]) <= 366)
    return {
      text: value,
      time: today.getTime() - Number(relative[1]) * 86400000,
    };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    if (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    )
      return { text: value, time: date.getTime() };
  }
  throw new BoundaryError("Invalid date range", 400);
}
export function createAnalyticsHandler(deps: PrivilegedDependencies) {
  return async (req: Request): Promise<Response> => {
    try {
      const origin = req.headers.get("origin");
      if (origin && !allowedOrigins.has(origin))
        throw new BoundaryError("Forbidden origin", 403, "FORBIDDEN");
      if (req.method === "OPTIONS") return json(req, { ok: true }, 200, true);
      if (req.method !== "POST")
        throw new BoundaryError(
          "Method not allowed",
          405,
          "METHOD_NOT_ALLOWED",
        );
      const admin = await deps.authenticateAdmin(req);
      if (!("userId" in admin))
        throw new BoundaryError(
          admin.status === 401 ? "Unauthorized" : "Forbidden",
          admin.status,
          admin.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
        );
      const input = await boundedJson(req, 1024);
      if (
        !isObject(input) ||
        Object.keys(input).some(
          (key) => !["startDate", "endDate"].includes(key),
        )
      )
        throw new BoundaryError("Invalid report request", 400);
      const start = parseDate(input.startDate ?? "30daysAgo");
      const end = parseDate(input.endDate ?? "today");
      if (
        start.time > end.time ||
        end.time - start.time > 366 * 86400000 ||
        end.time > Date.now()
      )
        throw new BoundaryError(
          "Date range must be ordered and no longer than 366 days",
          400,
        );
      if (
        !(await deps.reserve(
          "analytics",
          await callerHash(deps.hashKey, admin.userId),
        ))
      )
        throw new BoundaryError("Analytics limit reached", 429, "RATE_LIMITED");
      return json(req, await deps.analytics(start.text, end.text), 200, true);
    } catch (error) {
      return failure(req, error, true);
    }
  };
}
