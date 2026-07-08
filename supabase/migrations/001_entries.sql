create type domain_t as enum ('food','workout','travel','reading','journal','learning');
create type parse_source_t as enum ('rule','llm','manual');

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  ts timestamptz not null default now(),
  domain domain_t not null,
  raw_text text not null,
  data jsonb not null default '{}'::jsonb,
  parse_source parse_source_t not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create policy "own rows" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index entries_user_ts on public.entries (user_id, ts desc);
