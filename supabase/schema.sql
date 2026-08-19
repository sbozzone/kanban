-- Kanban schema. Run once in the Supabase SQL editor.
-- Safe to re-run: every statement is guarded.

create extension if not exists "pgcrypto";

create table if not exists public.cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 200),
  note        text not null default '' check (char_length(note) <= 2000),
  status      text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The board always reads "my cards, one column, in order".
create index if not exists cards_user_status_position_idx
  on public.cards (user_id, status, position);

-- Keep updated_at honest without trusting the client.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cards_touch_updated_at on public.cards;
create trigger cards_touch_updated_at
  before update on public.cards
  for each row execute function public.touch_updated_at();

-- Row level security: a card is only ever visible to the account that owns it.
alter table public.cards enable row level security;

drop policy if exists "cards are readable by their owner" on public.cards;
create policy "cards are readable by their owner"
  on public.cards for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "cards are insertable by their owner" on public.cards;
create policy "cards are insertable by their owner"
  on public.cards for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "cards are updatable by their owner" on public.cards;
create policy "cards are updatable by their owner"
  on public.cards for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cards are deletable by their owner" on public.cards;
create policy "cards are deletable by their owner"
  on public.cards for delete
  to authenticated
  using (auth.uid() = user_id);

-- Realtime: lets a change on the phone show up on the desktop without a refresh.
-- Realtime still honours the policies above, so only your own rows are broadcast.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cards'
  ) then
    alter publication supabase_realtime add table public.cards;
  end if;
end;
$$;

-- Realtime sends the previous row on updates/deletes only when replica identity
-- is full; without it the delete payload has no user_id to filter on.
alter table public.cards replica identity full;
