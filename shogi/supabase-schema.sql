-- NAGI SHOGI: guest rooms without Supabase Auth
-- Run this in Supabase SQL Editor.
create table if not exists public.rooms (
  room_id text primary key,
  player1 jsonb not null,
  player2 jsonb,
  board_state jsonb not null,
  constraint rooms_room_id_format check (room_id ~ '^[A-Z2-9]{7}$')
);

alter table public.rooms enable row level security;

drop policy if exists "Public can read shogi rooms" on public.rooms;
create policy "Public can read shogi rooms"
on public.rooms for select to anon, authenticated
using (true);

drop policy if exists "Guests can create shogi rooms" on public.rooms;
create policy "Guests can create shogi rooms"
on public.rooms for insert to anon, authenticated
with check (
  player2 is null
  and jsonb_typeof(player1) = 'object'
  and jsonb_typeof(board_state) = 'object'
);

drop policy if exists "Guests can join and update shogi rooms" on public.rooms;
create policy "Guests can join and update shogi rooms"
on public.rooms for update to anon, authenticated
using (true)
with check (
  jsonb_typeof(player1) = 'object'
  and (player2 is null or jsonb_typeof(player2) = 'object')
  and jsonb_typeof(board_state) = 'object'
);

grant select, insert, update on public.rooms to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'supabase_realtime publication not found; enable Realtime for public.rooms in the dashboard.';
end $$;
