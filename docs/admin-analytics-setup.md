# Admin Analytics Setup

The Admin Analytics page at `/admin/analytics` reads GA4 data through the Supabase Edge Function `analytics-proxy`.

## Required Supabase Edge Function secrets

This implementation uses Google OAuth refresh-token credentials, not a Google service-account key. Set these secrets in Supabase:

```bash
supabase secrets set GA4_PROPERTY_ID="123456789"
supabase secrets set GOOGLE_CLIENT_ID="your-google-oauth-client-id"
supabase secrets set GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
supabase secrets set GOOGLE_REFRESH_TOKEN="your-google-oauth-refresh-token"
```

The current function does not read `GOOGLE_CLIENT_EMAIL` or `GOOGLE_PRIVATE_KEY`. Adding those secrets alone will not fix this page unless the Edge Function is changed to use service-account authentication.

## Deploy the function

```bash
supabase functions deploy analytics-proxy
```

Verify the function and secret names without printing secret values:

```bash
supabase functions list
supabase secrets list
```

## Google Analytics access checklist

- `GA4_PROPERTY_ID` must be the numeric GA4 property ID, not the web measurement ID that starts with `G-`.
- The OAuth refresh token must be minted for the same Google OAuth client ID and client secret configured in Supabase.
- If Google returns `invalid_grant`, generate a new refresh token and update `GOOGLE_REFRESH_TOKEN`.
- The Google user/account behind the refresh token must have access to the GA4 property.
- The Google Analytics Data API must be enabled for the Google Cloud project that owns the OAuth client.

## Frontend analytics measurement ID

Public page-view tracking uses `REACT_APP_GA4_MEASUREMENT_ID` in the React app. That is separate from the admin reporting proxy and does not grant access to GA4 reports.
