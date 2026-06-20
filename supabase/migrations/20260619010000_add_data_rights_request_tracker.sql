-- Non-destructive admin intake and review tracker for privacy/data requests.
-- This migration intentionally provides no export, deletion, anonymization,
-- media-removal, or public self-service capability.

create table public.data_rights_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null,
  status text not null default 'intake',
  subject_auth_user_id uuid references auth.users(id) on delete set null,
  subject_member_id uuid references public.members(id) on delete set null,
  subject_display_name text,
  contact_channel text,
  contact_reference text,
  verification_status text not null default 'not_started',
  verification_method text,
  assigned_to uuid references auth.users(id) on delete set null,
  reviewer_id uuid references auth.users(id) on delete set null,
  priority text not null default 'normal',
  summary text,
  internal_notes text,
  decision text,
  completed_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_rights_requests_type_check check (
    request_type in (
      'review',
      'correction',
      'export',
      'deletion',
      'anonymization',
      'media_removal',
      'analytics_browser_help',
      'external_form',
      'other'
    )
  ),
  constraint data_rights_requests_status_check check (
    status in (
      'intake',
      'identity_verification',
      'preview_needed',
      'pending_review',
      'approved_for_future_action',
      'completed',
      'rejected',
      'cancelled'
    )
  ),
  constraint data_rights_requests_verification_check check (
    verification_status in ('not_started', 'pending', 'verified', 'failed', 'not_required')
  ),
  constraint data_rights_requests_priority_check check (priority in ('low', 'normal', 'high')),
  constraint data_rights_requests_independent_reviewer_check check (
    assigned_to is null or reviewer_id is null or assigned_to <> reviewer_id
  ),
  constraint data_rights_requests_subject_name_length check (
    subject_display_name is null or char_length(subject_display_name) <= 200
  ),
  constraint data_rights_requests_contact_channel_length check (
    contact_channel is null or char_length(contact_channel) <= 80
  ),
  constraint data_rights_requests_contact_reference_length check (
    contact_reference is null or char_length(contact_reference) <= 200
  ),
  constraint data_rights_requests_verification_method_length check (
    verification_method is null or char_length(verification_method) <= 200
  ),
  constraint data_rights_requests_summary_length check (
    summary is null or char_length(summary) <= 1000
  ),
  constraint data_rights_requests_internal_notes_length check (
    internal_notes is null or char_length(internal_notes) <= 2000
  ),
  constraint data_rights_requests_decision_length check (
    decision is null or char_length(decision) <= 1000
  )
);

comment on table public.data_rights_requests is
  'Admin-only, non-destructive intake and review metadata for data-rights requests.';
comment on column public.data_rights_requests.contact_reference is
  'Minimal opaque channel reference only; never store full conversations, documents, or private links.';
comment on column public.data_rights_requests.internal_notes is
  'Brief decision context only; never store identity documents, raw payloads, secrets, or unrelated private data.';

create index data_rights_requests_status_updated_idx
  on public.data_rights_requests (status, updated_at desc);
create index data_rights_requests_type_created_idx
  on public.data_rights_requests (request_type, created_at desc);
create index data_rights_requests_assignment_idx
  on public.data_rights_requests (assigned_to, reviewer_id)
  where assigned_to is not null or reviewer_id is not null;

create table public.data_rights_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.data_rights_requests(id) on delete restrict,
  event_type text not null,
  event_summary text not null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint data_rights_request_events_type_check check (
    event_type in (
      'created',
      'status_changed',
      'verification_changed',
      'workflow_updated',
      'details_updated'
    )
  ),
  constraint data_rights_request_events_summary_length check (
    char_length(event_summary) between 1 and 300
  )
);

comment on table public.data_rights_request_events is
  'Append-only admin audit events containing metadata changes, never request payloads.';

create index data_rights_request_events_request_created_idx
  on public.data_rights_request_events (request_id, created_at desc);

create or replace function public.set_data_rights_request_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, auth.uid());
    new.updated_by = coalesce(new.updated_by, auth.uid());
  else
    new.updated_by = auth.uid();
    new.updated_at = now();
  end if;

  if new.status = 'completed' and new.completed_at is null then
    new.completed_at = now();
  elsif new.status <> 'completed' then
    new.completed_at = null;
  end if;

  return new;
end;
$$;

create trigger set_data_rights_request_audit_fields
  before insert or update on public.data_rights_requests
  for each row
  execute function public.set_data_rights_request_audit_fields();

create or replace function public.record_data_rights_request_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.data_rights_request_events (request_id, event_type, event_summary, created_by)
    values (new.id, 'created', 'Request created', auth.uid());
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.data_rights_request_events (request_id, event_type, event_summary, created_by)
    values (
      new.id,
      'status_changed',
      'Status changed from ' || old.status || ' to ' || new.status,
      auth.uid()
    );
  end if;

  if new.verification_status is distinct from old.verification_status then
    insert into public.data_rights_request_events (request_id, event_type, event_summary, created_by)
    values (
      new.id,
      'verification_changed',
      'Verification changed from ' || old.verification_status || ' to ' || new.verification_status,
      auth.uid()
    );
  end if;

  if new.priority is distinct from old.priority
    or new.assigned_to is distinct from old.assigned_to
    or new.reviewer_id is distinct from old.reviewer_id then
    insert into public.data_rights_request_events (request_id, event_type, event_summary, created_by)
    values (new.id, 'workflow_updated', 'Priority or review assignment updated', auth.uid());
  end if;

  if new.request_type is distinct from old.request_type
    or new.subject_auth_user_id is distinct from old.subject_auth_user_id
    or new.subject_member_id is distinct from old.subject_member_id
    or new.subject_display_name is distinct from old.subject_display_name
    or new.contact_channel is distinct from old.contact_channel
    or new.contact_reference is distinct from old.contact_reference
    or new.verification_method is distinct from old.verification_method
    or new.summary is distinct from old.summary
    or new.internal_notes is distinct from old.internal_notes
    or new.decision is distinct from old.decision then
    insert into public.data_rights_request_events (request_id, event_type, event_summary, created_by)
    values (new.id, 'details_updated', 'Request metadata updated', auth.uid());
  end if;

  return new;
end;
$$;

create trigger record_data_rights_request_event
  after insert or update on public.data_rights_requests
  for each row
  execute function public.record_data_rights_request_event();

alter table public.data_rights_requests enable row level security;
alter table public.data_rights_request_events enable row level security;

create policy "Admins can view data rights requests"
  on public.data_rights_requests for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can create data rights requests"
  on public.data_rights_requests for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can update data rights requests"
  on public.data_rights_requests for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can view data rights request events"
  on public.data_rights_request_events for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- No DELETE policy exists for either table. Request events also have no UPDATE
-- or INSERT policy; the hardened request trigger is their only writer.
revoke all on public.data_rights_requests from anon, authenticated;
revoke all on public.data_rights_request_events from anon, authenticated;
grant select, insert, update on public.data_rights_requests to authenticated;
grant select on public.data_rights_request_events to authenticated;

revoke execute on function public.set_data_rights_request_audit_fields() from public;
revoke execute on function public.record_data_rights_request_event() from public;
