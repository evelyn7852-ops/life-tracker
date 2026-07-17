create type trip_status_t as enum ('planned','booked','done');
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  year int not null,
  slot text not null,
  period_hint text,
  destination text not null,
  country text,
  trip_type text,
  days int,
  status trip_status_t not null default 'planned',
  budget_cny int,
  budget_stale boolean not null default false,
  notes text,
  seed_key text,
  created_at timestamptz not null default now()
);
alter table public.trips enable row level security;
create policy "own rows" on public.trips for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index trips_user_year on public.trips (user_id, year);
create unique index trips_user_seedkey on public.trips (user_id, seed_key) where seed_key is not null;
