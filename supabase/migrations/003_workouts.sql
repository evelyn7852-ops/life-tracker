create type workout_status_t as enum ('planned','in_progress','done');

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  date date not null,
  template_id text,
  title text not null,
  blocks jsonb not null default '[]'::jsonb,
  status workout_status_t not null default 'planned',
  performed jsonb,
  created_at timestamptz not null default now()
);

alter table public.workouts enable row level security;

create policy "own rows" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index workouts_user_date on public.workouts (user_id, date);
