-- Run this entire file in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 30),
  message text not null check (char_length(btrim(message)) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.guestbook_entries enable row level security;

revoke all on public.guestbook_entries from anon, authenticated;
grant select, insert on public.guestbook_entries to anon, authenticated;

drop policy if exists "Anyone can read guestbook entries" on public.guestbook_entries;
create policy "Anyone can read guestbook entries"
on public.guestbook_entries
for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can create guestbook entries" on public.guestbook_entries;
create policy "Anyone can create guestbook entries"
on public.guestbook_entries
for insert
to anon, authenticated
with check (
  char_length(btrim(name)) between 1 and 30
  and char_length(btrim(message)) between 1 and 300
);

-- Required for INSERT events to reach the browser through Supabase Realtime.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'guestbook_entries'
  ) then
    alter publication supabase_realtime add table public.guestbook_entries;
  end if;
end $$;
