export const allowedOrigins = new Set([
  "https://www.vsaatucsd.com",
  "https://vsaatucsd.com",
  "http://localhost:3000",
  "http://localhost:5173",
]);

const DEFAULT_ORIGIN = "https://www.vsaatucsd.com";
const DEFAULT_ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type";
const DEFAULT_ALLOWED_METHODS = "POST, OPTIONS";

interface CorsHeadersOptions {
  allowedHeaders?: string;
  allowedMethods?: string;
  allowCredentials?: boolean;
}

export function corsHeaders(req: Request, options: CorsHeadersOptions = {}) {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : DEFAULT_ORIGIN,
    "Access-Control-Allow-Headers": options.allowedHeaders ?? DEFAULT_ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": options.allowedMethods ?? DEFAULT_ALLOWED_METHODS,
    "Vary": "Origin",
  };

  if (options.allowCredentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}
