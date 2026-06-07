-- GRIDLY V260.2 — Direct feedback submission storage
-- Creates anonymous insert-only beta feedback intake with no public read/update/delete policy.

create extension if not exists pgcrypto;

create table if not exists public.gridly_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null,
  message text not null,
  awareness_area text,
  platform text,
  gridly_version text,
  page_url text,
  user_agent text,
  status text not null default 'new',
  constraint gridly_feedback_category_length check (char_length(category) between 1 and 80),
  constraint gridly_feedback_message_length check (char_length(message) between 1 and 4000),
  constraint gridly_feedback_status_allowed check (status in ('new', 'reviewing', 'closed'))
);

alter table public.gridly_feedback enable row level security;

drop policy if exists "Allow anonymous feedback inserts" on public.gridly_feedback;

create policy "Allow anonymous feedback inserts"
  on public.gridly_feedback
  for insert
  to anon
  with check (
    category is not null
    and length(trim(category)) > 0
    and char_length(category) <= 80
    and message is not null
    and length(trim(message)) > 0
    and char_length(message) <= 4000
    and coalesce(status, 'new') = 'new'
  );

comment on table public.gridly_feedback is 'Gridly beta feedback intake. Public clients may insert only; no public select/update/delete policy is defined.';
comment on column public.gridly_feedback.user_agent is 'Optional privacy-reviewed diagnostic field. V260.2 client does not populate this field.';
