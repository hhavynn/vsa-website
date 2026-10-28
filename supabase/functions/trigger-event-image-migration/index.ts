import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createImageMigrationHandler } from "../_shared/privileged-handlers.ts";
import { createPrivilegedRuntime } from "../_shared/privileged-runtime.ts";

serve(async (req) =>
  createImageMigrationHandler("events", {
    ...createPrivilegedRuntime(),
    analytics: async () => ({}),
  })(req)
);
