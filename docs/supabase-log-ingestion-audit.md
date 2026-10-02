# Supabase Log Ingestion Audit Guide

How to monitor and reduce Supabase Log Ingestion usage for the VSA website.

The Free plan includes **1 GB/month** of log ingestion. When usage spiked to approximately **1.24 GB in ~2 days**, investigating and eliminating avoidable request and log churn became critical. This guide explains how to identify spikes and what common log sources mean.

---

## Checking current usage

1. Open **Supabase Dashboard → Project → Usage** (or Billing → Usage).
2. Look at **Log Ingestion** under the current billing period.
3. The usage chart shows daily ingestion volume. Spikes usually correlate with heavy API traffic, frequent Edge Function invocations, or noisy Postgres functions.

---

## Supabase Logs Explorer

Open **Supabase Dashboard → Logs → Logs Explorer** and run SQL queries against recent log data. Note: Supabase Logs SQL requires `count()` rather than `count(*)`.

### Top log sources by volume

```sql
select
  source,
  count() as events
from logs
group by source
order by events desc
limit 20;
```

### Busiest API paths

```sql
select
  log_attributes['request.path'] as path,
  log_attributes['request.method'] as method,
  count() as requests
from logs
where source = 'edge_logs'
group by path, method
order by requests desc
limit 50;
```

### Edge Function invocation frequency

```sql
select
  log_attributes['function_id'] as function_name,
  count() as invocations
from logs
where source = 'function_edge_logs'
group by function_name
order by invocations desc
limit 20;
```

### Auth activity

```sql
select
  log_attributes['msg'] as auth_event,
  count() as events
from logs
where source = 'auth_logs'
group by auth_event
order by events desc
limit 20;
```

---

## What the log sources mean

| Source | Description | Common causes of high volume |
|---|---|---|
| `edge_logs` | Every PostgREST API request (reads, writes, RPC calls). This is typically the largest source. | Polling queries, short `staleTime`, missing React Query caching, N+1 queries |
| `postgres_logs` | Postgres server logs: connection events, slow queries, errors, `RAISE NOTICE` output | Connection churn (many short-lived connections), `log_statement = 'all'` overrides, noisy `pg_cron` jobs |
| `storage_logs` | Storage API requests (uploads, downloads, signed URLs) | Unoptimized images served from Supabase Storage instead of CDN/static assets |
| `auth_logs` | Authentication events: sign-ins, token refreshes, session checks | Repeated `getSession()` or `getUser()` calls, short token expiry |
| `function_edge_logs` | Edge Function request/response invocation metadata (HTTP method, path, execution time, status) | Frequent webhook triggers, external polling, high invocation traffic |
| `function_logs` | Application logs (`console.log`, `console.error`, etc.) emitted during Edge Function execution | Verbose application logging (`console.log` on routine success paths), chatty debug logs |
| `realtime_logs` | Realtime subscription events: channel joins, leaves, broadcasts | Active Realtime subscriptions (this project currently has none in production) |

---

## Common waste patterns and fixes

### 1. Polling queries (refetchInterval)

A `refetchInterval: 30_000` on a query that 100 concurrent users have open generates ~200 requests/minute. Prefer normal `staleTime`-based caching unless near-real-time updates are a genuine UX requirement.

Note that setting `staleTime: 5 minutes` does not mean the open page polls every 5 minutes — cached data is considered fresh for 5 minutes and will only refresh on a subsequent query trigger, remount, or explicit cache invalidation rather than continuous polling.

**Check for:** `grep -rn 'refetchInterval' src/`

### 2. Window-focus refetching

The global default is `refetchOnWindowFocus: false`. Any hook overriding this to `true` will refetch every time a user alt-tabs back to the site.

**Check for:** `grep -rn 'refetchOnWindowFocus' src/`

### 3. cacheTime: 0

Setting `cacheTime: 0` means React Query discards data the moment a component unmounts. Navigating away and back always triggers a fresh fetch.

**Check for:** `grep -rn 'cacheTime.*0' src/`

### 4. Edge Function console.log on success

Every `console.log()` in an Edge Function generates a `function_logs` entry. Keep error logs; remove routine success logs.

### 5. Broad select('*')

Selecting all columns transfers more data per response. Prefer explicit column lists for queries on tables with large text/JSON columns to reduce egress and payload overhead.

---

## Important: Log Drains do not reduce ingestion

Setting up a Log Drain (e.g., to Datadog or Logflare) does **not** reduce your Log Ingestion usage. Supabase counts ingestion at the point logs are generated, before any drain forwarding. A drain is an additional destination, not a replacement.

---

## Previous optimization work

- **Egress optimization**: Migrated event/house images from Supabase Storage to Git repo static assets (served via Vercel CDN). See `docs/event-image-migration.md`.
- **React Query defaults**: Global `staleTime: 5min`, `cacheTime: 10min`, `refetchOnWindowFocus: false` set in `src/App.tsx`.
- **Storage audit queries**: `docs/supabase-usage-audit.sql` contains read-only queries for storage usage, orphaned objects, and duplicate detection.

---

## Maintenance checklist

When adding new queries or hooks:

1. Does the query inherit sensible global defaults, or does it override them aggressively?
2. Is `refetchInterval` justified by a real-time UX need?
3. Is `cacheTime: 0` intentional? (Almost never needed for public read queries.)
4. Are Edge Function success paths free of `console.log`?
5. Does the `select()` call request only the columns the component actually reads?
