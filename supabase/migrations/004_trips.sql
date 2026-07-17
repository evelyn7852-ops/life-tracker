-- status 用 text（非 enum）：部署时 enum 版遇残留 type 冲突，改 text 且全 if-not-exists 可重复跑。
-- app 端只写 'planned'|'booked'|'done'，text 约束足够。
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  year int not null,
  slot text not null,
  period_hint text,
  destination text not null,
  country text,
  trip_type text,
  days int,
  status text not null default 'planned',
  budget_cny int,
  budget_stale boolean not null default false,
  notes text,
  seed_key text,
  created_at timestamptz not null default now()
);
alter table public.trips enable row level security;
drop policy if exists "own rows" on public.trips;
create policy "own rows" on public.trips for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists trips_user_year on public.trips (user_id, year);
create unique index if not exists trips_user_seedkey on public.trips (user_id, seed_key) where seed_key is not null;
