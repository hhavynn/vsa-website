import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Adjust in production to specific domains
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    throw new Error(`Failed to refresh access token: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Check if user is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') throw new Error('Forbidden')

    // Get GA4 credentials from environment secrets
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');
    const propertyId = Deno.env.get('GA4_PROPERTY_ID');

    if (!clientId || !clientSecret || !refreshToken || !propertyId) {
      throw new Error('GA4 OAuth configuration missing');
    }

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
      throw new Error(`GA4 Data API Error: ${reportData.error?.message || JSON.stringify(reportData)}`);
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
      throw new Error(`GA4 Pages API Error: ${pagesData.error?.message || JSON.stringify(pagesData)}`);
    }

    // Process and return simplified data
    return new Response(JSON.stringify({
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
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
