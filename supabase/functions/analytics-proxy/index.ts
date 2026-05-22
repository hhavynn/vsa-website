import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Adjust in production to specific domains
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

class AnalyticsError extends Error {
  status: number
  code: string

  constructor(message: string, status = 500, code = 'ANALYTICS_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getRequiredEnv(name: string, publicMessage: string) {
  const value = Deno.env.get(name)
  if (!value) {
    throw new AnalyticsError(publicMessage, 503, `MISSING_${name}`)
  }
  return value
}

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const errorCode = data.error || 'token_refresh_failed'

    if (errorCode === 'invalid_grant') {
      throw new AnalyticsError(
        'Google OAuth refresh token is invalid or expired',
        502,
        'GOOGLE_OAUTH_INVALID_GRANT',
      )
    }

    if (errorCode === 'invalid_client') {
      throw new AnalyticsError(
        'Google OAuth client credentials were rejected',
        502,
        'GOOGLE_OAUTH_INVALID_CLIENT',
      )
    }

    throw new AnalyticsError(
      'Google OAuth access token refresh failed',
      502,
      'GOOGLE_OAUTH_REFRESH_FAILED',
    )
  }

  if (!data.access_token) {
    throw new AnalyticsError(
      'Google OAuth token response was missing an access token',
      502,
      'GOOGLE_OAUTH_TOKEN_MISSING',
    )
  }

  return data.access_token;
}

function getGa4Error(status: number, responseBody: any, reportName: string) {
  const googleStatus = responseBody?.error?.status
  const googleCode = responseBody?.error?.code

  if (status === 403 || googleStatus === 'PERMISSION_DENIED') {
    return new AnalyticsError(
      'GA4 API rejected the request: permission denied',
      502,
      'GA4_PERMISSION_DENIED',
    )
  }

  if (status === 401 || googleStatus === 'UNAUTHENTICATED') {
    return new AnalyticsError(
      'GA4 API rejected the request: credentials were not accepted',
      502,
      'GA4_UNAUTHENTICATED',
    )
  }

  if (status === 400) {
    return new AnalyticsError(
      'GA4 API rejected the request: invalid property ID or report request',
      502,
      'GA4_INVALID_REQUEST',
    )
  }

  return new AnalyticsError(
    `GA4 API failed while loading ${reportName}`,
    502,
    typeof googleStatus === 'string' ? `GA4_${googleStatus}` : `GA4_HTTP_${googleCode || status}`,
  )
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405)
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Check if user is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new AnalyticsError('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profile?.is_admin !== true) {
      throw new AnalyticsError('Forbidden', 403, 'FORBIDDEN')
    }

    // Get GA4 credentials from environment secrets
    const clientId = getRequiredEnv('GOOGLE_CLIENT_ID', 'Missing Google OAuth client ID');
    const clientSecret = getRequiredEnv('GOOGLE_CLIENT_SECRET', 'Missing Google OAuth client secret');
    const refreshToken = getRequiredEnv('GOOGLE_REFRESH_TOKEN', 'Missing Google OAuth refresh token');
    const propertyId = getRequiredEnv('GA4_PROPERTY_ID', 'Missing GA4 property ID');

    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const { startDate = '30daysAgo', endDate = 'today' } = await req.json().catch(() => ({}));

    // Fetch metrics (Summary and Trend)
    const reportRes = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "newUsers" }
        ],
        dimensions: [{ name: "date" }],
        orderBys: [{ dimension: { dimensionName: "date" } }]
      })
    });

    const reportData = await reportRes.json();
    if (!reportRes.ok) {
      throw getGa4Error(reportRes.status, reportData, 'analytics summary');
    }

    // Fetch top pages
    const pagesRes = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        limit: 10,
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }]
      })
    });
    
    const pagesData = await pagesRes.json();
    if (!pagesRes.ok) {
      throw getGa4Error(pagesRes.status, pagesData, 'top pages');
    }

    // Process and return simplified data
    return jsonResponse({
      summary: reportData.rows?.reduce((acc: any, row: any) => {
        acc.users += parseInt(row.metricValues[0].value);
        acc.sessions += parseInt(row.metricValues[1].value);
        acc.pageViews += parseInt(row.metricValues[2].value);
        acc.newUsers += parseInt(row.metricValues[3].value);
        return acc;
      }, { users: 0, sessions: 0, pageViews: 0, newUsers: 0 }) || { users: 0, sessions: 0, pageViews: 0, newUsers: 0 },
      trend: reportData.rows?.map((row: any) => ({
        date: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
        pageViews: parseInt(row.metricValues[2].value)
      })) || [],
      topPages: pagesData.rows?.map((row: any) => ({
        path: row.dimensionValues[0].value,
        views: parseInt(row.metricValues[0].value)
      })) || []
    });

  } catch (error) {
    const analyticsError = error instanceof AnalyticsError
      ? error
      : new AnalyticsError('Unexpected analytics service error', 500, 'UNEXPECTED_ANALYTICS_ERROR')

    console.error('analytics-proxy error', {
      code: analyticsError.code,
      status: analyticsError.status,
      message: analyticsError.message,
    })

    return jsonResponse({
      error: analyticsError.message,
      code: analyticsError.code,
    }, analyticsError.status)
  }
})
