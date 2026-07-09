create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  period_type text not null check (period_type in ('week', 'month')),
  period_start date not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.summaries enable row level security;

create policy "own rows" on public.summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One summary per user/period/period_start; summarize Edge Function upserts on this.
create unique index summaries_user_period on public.summaries (user_id, period_type, period_start);
