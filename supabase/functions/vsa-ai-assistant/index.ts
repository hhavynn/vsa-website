import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

// Required Supabase secrets:
// supabase secrets set GEMINI_API_KEY="..."
// supabase secrets set GEMINI_MODEL="gemini-3.1-flash-lite"
// Deploy with: supabase functions deploy vsa-ai-assistant

const allowedOrigins = new Set([
  "https://www.vsaatucsd.com",
  "https://vsaatucsd.com",
  "http://localhost:3000",
  "http://localhost:5173",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.vsaatucsd.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const FALLBACK_MESSAGE =
  "I'm not sure from the approved VSA info I have. Try the Events page, Feedback page, or official VSA channels.";

const RATE_LIMIT_MESSAGE = "You've reached today's Ask VSA limit. Try again later!";

const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

const SYSTEM_PROMPT = `You are the VSA AI Assistant for VSA at UCSD.

Answer only using the approved context provided in this request.
Do not use outside knowledge, guesses, assumptions, or training memory.
If the context does not answer the question, say: "I'm not sure from the approved VSA info I have."
Keep answers concise, friendly, and practical.
Do not invent event dates, times, locations, point values, application deadlines, or contact details.
Do not reveal or ask for private/admin information, member emails, attendance records, check-in codes, budgets, cabinet-only documents, or raw member data.
Do not answer medical, legal, financial, emergency, or deeply personal questions. Redirect to appropriate official resources.
When useful, mention the source snippet titles used under "Sources:".
For contact or feedback questions, point users to the official public feedback page or public VSA channels if those are present in context.`;

const RecentTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(500),
});

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(500),
  sessionId: z.string().trim().min(8).max(160),
  recentTurns: z.array(RecentTurnSchema).optional().default([]),
  currentPage: z.string().trim().max(120).optional(),
});

type AssistantStatus = "answered" | "fallback" | "rate_limited" | "error";

interface KnowledgeSnippet {
  id: string;
  title: string;
  content: string;
  category: string;
  source_type: string;
  source_url: string | null;
  rank?: number;
}

interface SourceChip {
  title: string;
  source_url: string | null;
  category: string;
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

function trimRecentTurns(turns: Array<{ role: "user" | "assistant"; content: string }>) {
  const recent = turns.slice(-4);
  let used = 0;
  const trimmed: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const turn of recent) {
    const remaining = 1500 - used;
    if (remaining <= 0) break;
    const content = turn.content.slice(0, remaining);
    used += content.length;
    trimmed.push({ role: turn.role, content });
  }

  return trimmed;
}

function asksForNextEvent(message: string) {
  return /\b(next|upcoming|soon|when)\b/i.test(message) && /\b(event|gbm|meeting|social)\b/i.test(message);
}

function isSafetyRedirect(message: string) {
  return /\b(medical|legal|lawyer|attorney|emergency|911|diagnosis|therapy|financial advice|tax advice)\b/i.test(message);
}

function asksForSensitivePrivateInfo(message: string) {
  return /\b(private|personal|phone number|email|address|attendance|check-?in code|check in code|budget|cabinet-only|drive doc|member data)\b/i.test(message);
}

function buildContext(snippets: KnowledgeSnippet[], eventContext: string | null) {
  const snippetContext = snippets
    .map((snippet, index) => {
      const source = snippet.source_url ? ` (${snippet.source_url})` : "";
      return `[${index + 1}] ${snippet.title}${source}\nCategory: ${snippet.category}\n${snippet.content}`;
    })
    .join("\n\n");

  return [snippetContext, eventContext ? `Public upcoming events context:\n${eventContext}` : ""]
    .filter(Boolean)
    .join("\n\n");
}

function sourceChips(snippets: KnowledgeSnippet[], hasEventContext: boolean): SourceChip[] {
  const map = new Map<string, SourceChip>();
  for (const snippet of snippets) {
    map.set(snippet.id, {
      title: snippet.title,
      source_url: snippet.source_url,
      category: snippet.category,
    });
  }
  if (hasEventContext) {
    map.set("public-events", {
      title: "Public upcoming events",
      source_url: "/events",
      category: "events",
    });
  }
  return Array.from(map.values()).slice(0, 7);
}

async function logUsage(
  supabaseClient: ReturnType<typeof createClient>,
  payload: {
    sessionIdHash: string;
    ipHash: string | null;
    matchedKnowledgeIds?: string[];
    status: AssistantStatus;
    messageLength: number;
    blockedReason?: string;
    currentPage?: string;
  },
) {
  await supabaseClient.from("ai_chat_usage_logs").insert({
    session_id_hash: payload.sessionIdHash,
    ip_hash: payload.ipHash,
    message_count: 1,
    blocked_reason: payload.blockedReason ?? null,
    matched_knowledge_ids: payload.matchedKnowledgeIds ?? [],
    metadata: {
      status: payload.status,
      message_length: payload.messageLength,
      current_page: payload.currentPage ?? null,
    },
  });
}

async function countUsage(
  supabaseClient: ReturnType<typeof createClient>,
  column: "session_id_hash" | "ip_hash",
  value: string,
  since: Date,
) {
  const { count, error } = await supabaseClient
    .from("ai_chat_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .gte("created_at", since.toISOString());

  if (error) throw error;
  return count ?? 0;
}

async function getRateLimitReason(
  supabaseClient: ReturnType<typeof createClient>,
  sessionIdHash: string,
  ipHash: string | null,
) {
  const now = Date.now();
  const sessionDay = await countUsage(supabaseClient, "session_id_hash", sessionIdHash, new Date(now - 24 * 60 * 60 * 1000));
  if (sessionDay >= 5) return "session_daily_limit";

  const sessionBurst = await countUsage(supabaseClient, "session_id_hash", sessionIdHash, new Date(now - 5 * 60 * 1000));
  if (sessionBurst >= 2) return "session_5_minute_limit";

  if (ipHash) {
    const ipDay = await countUsage(supabaseClient, "ip_hash", ipHash, new Date(now - 24 * 60 * 60 * 1000));
    if (ipDay >= 50) return "ip_daily_limit";

    const ipHour = await countUsage(supabaseClient, "ip_hash", ipHash, new Date(now - 60 * 60 * 1000));
    if (ipHour >= 10) return "ip_hourly_limit";
  }

  return null;
}

async function retrieveKnowledge(
  supabaseClient: ReturnType<typeof createClient>,
  message: string,
  currentPage?: string,
) {
  const query = [message, currentPage ?? ""].filter(Boolean).join(" ");
  const { data, error } = await supabaseClient.rpc("match_ai_knowledge_base", {
    query_text: query,
    match_limit: 6,
  });

  if (error) throw error;
  return (data ?? []) as KnowledgeSnippet[];
}

async function getUpcomingEventsContext(supabaseClient: ReturnType<typeof createClient>) {
  const { data, error } = await supabaseClient
    .from("events")
    .select("name, date, location, event_type, points, description")
    .gte("date", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("date", { ascending: true })
    .limit(3);

  if (error || !data || data.length === 0) return null;

  return data
    .map((event: any, index: number) => {
      const pieces = [
        `${index + 1}. ${event.name}`,
        event.date ? `date: ${event.date}` : null,
        event.location ? `location: ${event.location}` : null,
        event.event_type ? `type: ${event.event_type}` : null,
        typeof event.points === "number" ? `points: ${event.points}` : null,
        event.description ? `description: ${String(event.description).slice(0, 240)}` : null,
      ].filter(Boolean);
      return pieces.join("; ");
    })
    .join("\n");
}

async function callGemini({
  apiKey,
  model,
  message,
  context,
  recentTurns,
}: {
  apiKey: string;
  model: string;
  message: string;
  context: string;
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const contextParts = [
    recentTurns.length > 0
      ? `Recent conversation context, for reference only. Do not answer from this unless it is supported by approved context:\n${recentTurns
        .map((turn) => `${turn.role}: ${turn.content}`)
        .join("\n")}`
      : "",
    `Approved context:\n${context}`,
    `User question:\n${message}`,
  ].filter(Boolean);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: contextParts.join("\n\n") }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 220,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("vsa-ai-assistant provider error", {
      status: response.status,
      body: errorText.slice(0, 500),
    });
    throw new Error("AI provider request failed");
  }

  const body = await response.json();
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part: { text?: string }) => part.text ?? "").join("").trim() || FALLBACK_MESSAGE;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed", status: "error" }, 405);
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  let parsed: z.infer<typeof RequestSchema> | null = null;
  let sessionIdHash = "";
  let ipHash: string | null = null;

  try {
    const body = await req.json();
    const validation = RequestSchema.safeParse(body);
    if (!validation.success) {
      return jsonResponse(req, { error: "Invalid request", status: "error" }, 400);
    }

    parsed = validation.data;
    sessionIdHash = await sha256Hex(parsed.sessionId);
    const ip = getClientIp(req);
    ipHash = ip ? await sha256Hex(ip) : null;

    if (Deno.env.get("VSA_AI_ASSISTANT_ENABLED") === "false") {
      await logUsage(supabaseClient, {
        sessionIdHash,
        ipHash,
        status: "fallback",
        messageLength: parsed.message.length,
        blockedReason: "disabled",
        currentPage: parsed.currentPage,
      });
      return jsonResponse(req, { answer: FALLBACK_MESSAGE, sources: [], status: "fallback" });
    }

    const rateLimitReason = await getRateLimitReason(supabaseClient, sessionIdHash, ipHash);
    if (rateLimitReason) {
      await logUsage(supabaseClient, {
        sessionIdHash,
        ipHash,
        status: "rate_limited",
        messageLength: parsed.message.length,
        blockedReason: rateLimitReason,
        currentPage: parsed.currentPage,
      });
      return jsonResponse(
        req,
        { answer: RATE_LIMIT_MESSAGE, sources: [], status: "rate_limited" },
        429,
      );
    }

    if (isSafetyRedirect(parsed.message) || asksForSensitivePrivateInfo(parsed.message)) {
      await logUsage(supabaseClient, {
        sessionIdHash,
        ipHash,
        status: "fallback",
        messageLength: parsed.message.length,
        blockedReason: isSafetyRedirect(parsed.message) ? "safety_redirect" : "private_info_request",
        currentPage: parsed.currentPage,
      });
      return jsonResponse(req, { answer: FALLBACK_MESSAGE, sources: [], status: "fallback" });
    }

    const snippets = await retrieveKnowledge(supabaseClient, parsed.message, parsed.currentPage);
    const eventContext = asksForNextEvent(parsed.message)
      ? await getUpcomingEventsContext(supabaseClient)
      : null;

    if (snippets.length === 0) {
      await logUsage(supabaseClient, {
        sessionIdHash,
        ipHash,
        status: "fallback",
        messageLength: parsed.message.length,
        blockedReason: "no_relevant_context",
        currentPage: parsed.currentPage,
      });
      return jsonResponse(req, { answer: FALLBACK_MESSAGE, sources: [], status: "fallback" });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      await logUsage(supabaseClient, {
        sessionIdHash,
        ipHash,
        status: "error",
        messageLength: parsed.message.length,
        matchedKnowledgeIds: snippets.map((snippet) => snippet.id),
        blockedReason: "missing_gemini_api_key",
        currentPage: parsed.currentPage,
      });
      return jsonResponse(
        req,
        {
          answer: "Ask VSA is not fully configured yet. Try the Events page, Feedback page, or official VSA channels.",
          sources: sourceChips(snippets, !!eventContext),
          status: "error",
        },
        503,
      );
    }

    const recentTurns = trimRecentTurns(parsed.recentTurns);
    const context = buildContext(snippets, eventContext);
    const answer = await callGemini({
      apiKey,
      model: Deno.env.get("GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL,
      message: parsed.message,
      context,
      recentTurns,
    });

    await logUsage(supabaseClient, {
      sessionIdHash,
      ipHash,
      status: "answered",
      messageLength: parsed.message.length,
      matchedKnowledgeIds: snippets.map((snippet) => snippet.id),
      currentPage: parsed.currentPage,
    });

    return jsonResponse(req, {
      answer,
      sources: sourceChips(snippets, !!eventContext),
      status: "answered",
    });
  } catch (error) {
    console.error("vsa-ai-assistant error", error);

    if (parsed && sessionIdHash) {
      await logUsage(supabaseClient, {
        sessionIdHash,
        ipHash,
        status: "error",
        messageLength: parsed.message.length,
        blockedReason: "unexpected_error",
        currentPage: parsed.currentPage,
      }).catch((logError) => console.error("vsa-ai-assistant log error", logError));
    }

    return jsonResponse(
      req,
      {
        answer: "Ask VSA is having trouble right now. Try again later or use the Feedback page.",
        sources: [],
        status: "error",
      },
      500,
    );
  }
});
