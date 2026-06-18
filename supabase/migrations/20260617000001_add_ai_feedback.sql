-- Migration: Add Ask VSA Feedback Loop
-- Description: Table for users to rate AI answers and provide optional feedback.

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  rating text not null check (rating in ('helpful', 'not_helpful')),
  category text,
  page_path text,
  feedback_text text,
  answer_excerpt text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  admin_notes text
);

alter table public.ai_feedback enable row level security;

-- Public can insert
create policy "Public can insert AI feedback"
  on public.ai_feedback
  for insert
  with check (true);

-- Public cannot select (implicit deny by not adding a policy for anon/authenticated)

-- Admins can manage
create policy "Admins can manage AI feedback"
  on public.ai_feedback
  for all
  using (
    exists (
      select 1
      from public.user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.is_admin = true
    )
  );
