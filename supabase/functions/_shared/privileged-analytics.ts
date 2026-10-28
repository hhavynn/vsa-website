import { BoundaryError, isObject } from "./privileged-handlers.ts";

interface ReportRow {
  dimensionValues: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}
function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new BoundaryError(
      "Analytics service unavailable",
      503,
      "SERVICE_UNAVAILABLE",
    );
  }
  return value;
}
async function googleJson(
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new BoundaryError(
        "Analytics upstream request failed",
        502,
        "ANALYTICS_UPSTREAM_ERROR",
      );
    }
    const data: unknown = await response.json();
    if (!isObject(data)) throw new Error("Invalid response");
    return data;
  } catch (error) {
    if (error instanceof BoundaryError) throw error;
    throw new BoundaryError(
      "Analytics upstream request failed",
      502,
      "ANALYTICS_UPSTREAM_ERROR",
    );
  }
}
function rows(data: Record<string, unknown>, metrics: number): ReportRow[] {
  if (data.rows === undefined) return [];
  if (!Array.isArray(data.rows) || data.rows.length > 1000) {
    throw new BoundaryError(
      "Invalid analytics response",
      502,
      "ANALYTICS_UPSTREAM_ERROR",
    );
  }
  const validValue = (value: unknown): value is { value: string } =>
    isObject(value) && typeof value.value === "string";
  if (
    !data.rows.every((row: unknown) =>
      isObject(row) && Array.isArray(row.dimensionValues) &&
      row.dimensionValues.length === 1 &&
      row.dimensionValues.every(validValue) &&
      Array.isArray(row.metricValues) && row.metricValues.length === metrics &&
      row.metricValues.every((value: unknown) =>
        validValue(value) && /^\d{1,15}$/.test(value.value)
      )
    )
  ) {
    throw new BoundaryError(
      "Invalid analytics response",
      502,
      "ANALYTICS_UPSTREAM_ERROR",
    );
  }
  return data.rows as ReportRow[];
}
export async function loadAnalytics(
  startDate: string,
  endDate: string,
): Promise<Record<string, unknown>> {
  const property = requiredEnv("GA4_PROPERTY_ID");
  if (!/^\d+$/.test(property)) {
    throw new BoundaryError(
      "Analytics service unavailable",
      503,
      "SERVICE_UNAVAILABLE",
    );
  }
  const token = await googleJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: requiredEnv("GOOGLE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  if (typeof token.access_token !== "string" || !token.access_token) {
    throw new BoundaryError(
      "Analytics upstream request failed",
      502,
      "ANALYTICS_UPSTREAM_ERROR",
    );
  }
  const report = async (body: Record<string, unknown>) =>
    googleJson(
      `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dateRanges: [{ startDate, endDate }], ...body }),
      },
    );
  const reportData = await report({
    metrics: [{ name: "activeUsers" }, { name: "sessions" }, {
      name: "screenPageViews",
    }, { name: "newUsers" }],
    dimensions: [{ name: "date" }],
    limit: 367,
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });
  const pagesData = await report({
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    limit: 10,
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
  });
  const trendRows = rows(reportData, 4);
  const pageRows = rows(pagesData, 1);
  return {
    summary: trendRows.reduce((acc, row) => ({
      users: acc.users + Number(row.metricValues[0].value),
      sessions: acc.sessions + Number(row.metricValues[1].value),
      pageViews: acc.pageViews + Number(row.metricValues[2].value),
      newUsers: acc.newUsers + Number(row.metricValues[3].value),
    }), { users: 0, sessions: 0, pageViews: 0, newUsers: 0 }),
    trend: trendRows.map((row) => ({
      date: row.dimensionValues[0].value,
      users: Number(row.metricValues[0].value),
      pageViews: Number(row.metricValues[2].value),
    })),
    topPages: pageRows.map((row) => ({
      path: row.dimensionValues[0].value,
      views: Number(row.metricValues[0].value),
    })),
  };
}
