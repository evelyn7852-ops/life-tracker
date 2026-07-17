create table if not exists public.learning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  title text not null,
  url text,
  source text,
  tag text,
  status text not null default '待读',
  note text,
  added_by text not null default 'manual',
  created_at timestamptz not null default now()
);
alter table public.learning_items enable row level security;
drop policy if exists "own rows" on public.learning_items;
create policy "own rows" on public.learning_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists learning_items_user_status on public.learning_items (user_id, status);

create table if not exists public.learning_progress (
  user_id uuid not null default auth.uid() references auth.users(id),
  item_id text not null,
  done boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.learning_progress enable row level security;
drop policy if exists "own rows" on public.learning_progress;
create policy "own rows" on public.learning_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
