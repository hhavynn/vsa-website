import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  BoundaryError,
  type PrivilegedDependencies,
} from "./privileged-handlers.ts";

export function quotaLimits(scope: "image-migration" | "analytics") {
  const image = scope === "image-migration";
  const read = (name: string, fallback: number, ceiling: number) => {
    const raw = Deno.env.get(name);
    if (raw === undefined) return fallback;
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > ceiling) {
      throw new BoundaryError(
        "Service unavailable",
        503,
        "SERVICE_UNAVAILABLE",
      );
    }
    return Number(raw);
  };
  return {
    minute: read(
      image
        ? "IMAGE_MIGRATION_CALLER_PER_MINUTE"
        : "ANALYTICS_CALLER_PER_MINUTE",
      image ? 6 : 12,
      120,
    ),
    day: read(
      image ? "IMAGE_MIGRATION_GLOBAL_PER_DAY" : "ANALYTICS_GLOBAL_PER_DAY",
      image ? 50 : 500,
      10000,
    ),
  };
}
export function createPrivilegedRuntime(): Omit<
  PrivilegedDependencies,
  "analytics"
> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const backend = url && serviceKey
    ? createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;
  return {
    webhookSecret: Deno.env.get("IMAGE_MIGRATION_WEBHOOK_SECRET") ?? "",
    hashKey: serviceKey,
    projectUrl: url,
    async authenticateAdmin(req) {
      const auth = req.headers.get("authorization");
      if (!auth || !/^Bearer \S+$/i.test(auth)) return { status: 401 };
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      if (!url || !anonKey) {
        throw new BoundaryError(
          "Service unavailable",
          503,
          "SERVICE_UNAVAILABLE",
        );
      }
      const caller = createClient(url, anonKey, {
        global: { headers: { Authorization: auth } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: { user }, error } = await caller.auth.getUser();
      if (error || !user) return { status: 401 };
      const { data: isAdmin, error: adminError } = await caller.rpc(
        "is_admin_user",
        { p_user_id: user.id },
      );
      if (adminError || isAdmin !== true) return { status: 403 };
      return { userId: user.id };
    },
    async reserve(scope, caller) {
      if (!backend) {
        throw new BoundaryError(
          "Service unavailable",
          503,
          "SERVICE_UNAVAILABLE",
        );
      }
      const limit = quotaLimits(scope);
      const { data, error } = await backend.rpc(
        "reserve_privileged_edge_quota",
        {
          p_scope: scope,
          p_caller_hash: caller,
          p_caller_per_minute: limit.minute,
          p_global_per_day: limit.day,
        },
      );
      if (error || typeof data !== "boolean") {
        throw new BoundaryError(
          "Service unavailable",
          503,
          "SERVICE_UNAVAILABLE",
        );
      }
      return data;
    },
    async dispatch(table, id, imageUrl) {
      const repo = Deno.env.get("GITHUB_REPOSITORY");
      const token = Deno.env.get("GITHUB_DISPATCH_TOKEN");
      if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) {
        throw new BoundaryError(
          "Service unavailable",
          503,
          "SERVICE_UNAVAILABLE",
        );
      }
      const house = table === "house_events";
      const eventType = Deno.env.get(
        house
          ? "GITHUB_DISPATCH_EVENT_TYPE_HOUSE"
          : "GITHUB_DISPATCH_EVENT_TYPE",
      ) ?? (house
        ? "house-event-image-migration-requested"
        : "event-image-migration-requested");
      if (eventType.length > 100) {
        throw new BoundaryError(
          "Service unavailable",
          503,
          "SERVICE_UNAVAILABLE",
        );
      }
      try {
        const response = await fetch(
          `https://api.github.com/repos/${repo}/dispatches`,
          {
            method: "POST",
            signal: AbortSignal.timeout(10000),
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({
              event_type: eventType,
              client_payload: house
                ? {
                  category: "house-events",
                  house_event_id: id,
                  image_url: imageUrl,
                  source: "supabase-house-event-webhook",
                }
                : {
                  event_id: id,
                  image_url: imageUrl,
                  source: "supabase-event-webhook",
                },
            }),
          },
        );
        await response.body?.cancel();
        return response.ok;
      } catch {
        throw new BoundaryError(
          "GitHub dispatch failed",
          502,
          "UPSTREAM_ERROR",
        );
      }
    },
  };
}
