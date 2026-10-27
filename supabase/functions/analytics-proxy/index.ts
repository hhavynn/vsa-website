import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAnalyticsHandler } from "../_shared/privileged-handlers.ts";
import { createPrivilegedRuntime } from "../_shared/privileged-runtime.ts";
import { loadAnalytics } from "../_shared/privileged-analytics.ts";

serve(async (req) =>
  createAnalyticsHandler({
    ...createPrivilegedRuntime(),
    analytics: loadAnalytics,
  })(req)
);
