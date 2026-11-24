create extension if not exists pgcrypto;
create table if not exists public.shogi_rooms (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 sente_uid uuid not null, gote_uid uuid, sente_name text not null, gote_name text,
 state jsonb not null, status text not null default 'waiting' check(status in('waiting','playing','finished')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.shogi_rooms enable row level security;
revoke all on public.shogi_rooms from anon,authenticated;
grant select on public.shogi_rooms to authenticated;
drop policy if exists "participants read room" on public.shogi_rooms;
create policy "participants read room" on public.shogi_rooms for select to authenticated using(auth.uid()=sente_uid or auth.uid()=gote_uid);
create or replace function public.create_shogi_room(p_name text,p_state jsonb) returns public.shogi_rooms language plpgsql security definer set search_path=public as $$
declare r public.shogi_rooms;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 insert into shogi_rooms(code,sente_uid,sente_name,state) values(upper(substr(encode(gen_random_bytes(5),'hex'),1,6)),auth.uid(),left(coalesce(nullif(trim(p_name),''),'Player'),18),p_state) returning * into r;
 return r;
end $$;
create or replace function public.join_shogi_room(p_code text,p_name text) returns public.shogi_rooms language plpgsql security definer set search_path=public as $$
declare r public.shogi_rooms;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into r from shogi_rooms where code=upper(trim(p_code)) for update;
 if not found then raise exception 'Room not found'; end if;
 if r.status<>'waiting' or r.gote_uid is not null then raise exception 'Room is full'; end if;
 if r.sente_uid=auth.uid() then raise exception 'You created this room'; end if;
 update shogi_rooms set gote_uid=auth.uid(),gote_name=left(coalesce(nullif(trim(p_name),''),'Player'),18),status='playing',updated_at=now() where id=r.id returning * into r;
 return r;
end $$;
create or replace function public.submit_shogi_move(p_room_id uuid,p_state jsonb) returns void language plpgsql security definer set search_path=public as $$
declare r public.shogi_rooms; expected uuid; nt integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into r from shogi_rooms where id=p_room_id for update;
 if not found or r.status<>'playing' then raise exception 'Room unavailable'; end if;
 nt:=(p_state->>'turn')::integer;
 if nt not in(0,1) then raise exception 'Invalid turn'; end if;
 expected:=case when nt=1 then r.sente_uid else r.gote_uid end;
 if auth.uid()<>expected then raise exception 'Not your turn'; end if;
 if jsonb_typeof(p_state->'board')<>'array' or jsonb_array_length(p_state->'board')<>9 then raise exception 'Invalid board'; end if;
 if jsonb_typeof(p_state->'hands')<>'array' or jsonb_array_length(p_state->'hands')<>2 then raise exception 'Invalid hands'; end if;
 update shogi_rooms set state=p_state,updated_at=now() where id=p_room_id;
end $$;
grant execute on function public.create_shogi_room(text,jsonb) to authenticated;
grant execute on function public.join_shogi_room(text,text) to authenticated;
grant execute on function public.submit_shogi_move(uuid,jsonb) to authenticated;
do $$ begin alter publication supabase_realtime add table public.shogi_rooms; exception when duplicate_object then null; when undefined_object then null; end $$;
