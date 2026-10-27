import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFeedbackHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const backend =
  url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

serve(
  createFeedbackHandler({
    async authenticate(request) {
      if (!backend || !anonKey)
        throw new Error("Feedback configuration unavailable");
      const header = request.headers.get("authorization");
      // functions.invoke sends the public anon key when there is no session.
      if (!header || header === `Bearer ${anonKey}`) return { userId: null };
      const match = /^Bearer (\S+)$/i.exec(header);
      if (!match) return null;
      const { data, error } = await backend.auth.getUser(match[1]);
      return !error && data.user ? { userId: data.user.id } : null;
    },
    async submit(input, userId) {
      if (!backend) return "unavailable";
      const { data, error } = await backend.rpc("submit_feedback_guarded", {
        p_type: input.type,
        p_title: input.title,
        p_description: input.description,
        p_name: input.name,
        p_email: input.email,
        p_user_id: userId,
      });
      if (error)
        return error.code === "P0001" && error.message === "feedback_rate_limit"
          ? "limit"
          : "unavailable";
      return data === true ? "ok" : "unavailable";
    },
  }),
);
