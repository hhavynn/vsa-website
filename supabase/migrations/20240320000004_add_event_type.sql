-- Add event_type column to events table
alter table public.events 
add column if not exists event_type text not null default 'general';