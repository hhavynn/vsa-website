import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPhotoUploadHandler } from "./handler.ts";

const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const backend = serviceKey && supabaseUrl
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

serve(createPhotoUploadHandler({
  hashKey: serviceKey,
  async reserve(input, ipHash) {
    if (!backend) return { error: "unavailable" };
    const { data, error } = await backend.rpc("reserve_member_photo_upload", {
      p_ip_hash: ipHash, p_member_id: input.matchedMemberId,
      p_name: input.submittedName, p_email: input.submittedEmail,
      p_note: input.noteToAdmins, p_content_type: input.contentType, p_size: input.size,
    });
    if (error) {
      // P0001 is a RAISE EXCEPTION from our own functions (quota or pending-request
      // limit), whose text is written for visitors. Anything else stays generic.
      if (error.code === "P0001" && error.message) return { error: "limit", message: error.message };
      return { error: error.code === "22023" ? "invalid" : "unavailable" };
    }
    const path = data?.[0]?.pending_path;
    return typeof path === "string" ? { path } : { error: "unavailable" };
  },
  async sign(path) {
    if (!backend) return null;
    const { data, error } = await backend.storage.from("member-photo-requests")
      .createSignedUploadUrl(path, { upsert: false });
    return error ? null : data.token;
  },
}));
