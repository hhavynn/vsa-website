export interface FeedbackInput {
  type: string;
  title: string;
  description: string;
  name: string | null;
  email: string | null;
}
export interface FeedbackDependencies {
  authenticate: (request: Request) => Promise<{ userId: string | null } | null>;
  submit: (input: FeedbackInput, userId: string | null) => Promise<'ok' | 'limit' | 'unavailable'>;
}
const fields = new Set(['type', 'title', 'description', 'name', 'email']);
const categories = new Set(['bug', 'feature', 'improvement', 'event', 'other']);

function parseInput(value: unknown): FeedbackInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((field) => !fields.has(field))) return null;
  if (typeof v.type !== 'string' || !categories.has(v.type)) return null;
  if (typeof v.title !== 'string' || !v.title.trim() || v.title.length > 100) return null;
  if (typeof v.description !== 'string' || !v.description.trim() || v.description.length > 1000) return null;
  if (v.name !== undefined && (typeof v.name !== 'string' || v.name.length > 100)) return null;
  if (v.email !== undefined && (typeof v.email !== 'string' || v.email.length > 254 ||
    (v.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())))) return null;
  return { type: v.type, title: v.title.trim(), description: v.description.trim(),
    name: typeof v.name === 'string' ? v.name.trim() || null : null,
    email: typeof v.email === 'string' ? v.email.trim() || null : null };
}

async function readBody(req: Request): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) return null;
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function createFeedbackHandler(deps: FeedbackDependencies) {
  return async (request: Request): Promise<Response> => {
    const headers = { ...corsHeaders(request, {
      allowedHeaders: 'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
    }), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    const fail = (status: number, error: string) => new Response(JSON.stringify({ error }), {
      status, headers: status === 429 ? { ...headers, 'Retry-After': '3600' } : headers,
    });
    if (request.method === 'OPTIONS') return new Response('ok', { headers });
    if (request.method !== 'POST') return fail(405, 'Use POST to submit feedback.');
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return fail(415, 'Submit feedback as JSON.');
    }
    let input: FeedbackInput | null;
    try {
      const body = await readBody(request);
      if (body === null) return fail(413, 'Feedback is too large.');
      input = parseInput(JSON.parse(body));
    } catch {
      return fail(400, 'Invalid feedback. Check the fields and try again.');
    }
    if (!input) return fail(400, 'Invalid feedback. Check the fields and try again.');
    try {
      const identity = await deps.authenticate(request);
      if (!identity) return fail(401, 'Your session could not be verified. Sign in again or submit while signed out.');
      const result = await deps.submit(input, identity.userId);
      if (result === 'limit') return fail(429, 'Too many feedback submissions. Please try again later.');
      if (result !== 'ok') return fail(503, 'Feedback is unavailable. Please try again later.');
      return new Response(JSON.stringify({ success: true }), { headers });
    } catch {
      return fail(503, 'Feedback is unavailable. Please try again later.');
    }
  };
}
import { corsHeaders } from '../_shared/cors.ts';

