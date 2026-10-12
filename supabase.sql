create extension if not exists pgcrypto;

create table if not exists public.tracks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, description text, playlist_id text, thumbnail_url text, goal_type text not null check(goal_type in ('minutes','videos')),
 daily_goal integer not null default 30 check(daily_goal > 0), color text default '#8b5cf6', created_at timestamptz not null default now()
);
create table if not exists public.lessons (
 id uuid primary key default gen_random_uuid(), track_id uuid not null references public.tracks(id) on delete cascade,
 youtube_id text not null, title text not null, duration_seconds integer default 0, position integer default 0, thumbnail_url text, created_at timestamptz not null default now(),
 unique(track_id,youtube_id)
);
create table if not exists public.study_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 track_id uuid not null references public.tracks(id) on delete cascade, lesson_id uuid not null references public.lessons(id) on delete cascade,
 started_at timestamptz not null default now(), seconds integer not null default 0 check(seconds >= 0)
);
create index if not exists study_sessions_user_date_idx on public.study_sessions(user_id, started_at);
create index if not exists lessons_track_idx on public.lessons(track_id,position);

alter table public.tracks enable row level security;
alter table public.lessons enable row level security;
alter table public.study_sessions enable row level security;

drop policy if exists "tracks own" on public.tracks;
create policy "tracks own" on public.tracks for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "lessons own" on public.lessons;
create policy "lessons own" on public.lessons for all using(exists(select 1 from public.tracks t where t.id=track_id and t.user_id=auth.uid())) with check(exists(select 1 from public.tracks t where t.id=track_id and t.user_id=auth.uid()));
drop policy if exists "sessions own" on public.study_sessions;
create policy "sessions own" on public.study_sessions for all using(auth.uid()=user_id) with check(auth.uid()=user_id);


-- Atomic track creation: lesson failures roll back the track insert.
create or replace function public.create_track_with_lessons(p_track jsonb,p_lessons jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare new_track public.tracks; new_lessons jsonb;
begin
 if auth.uid() is null or (p_track->>'user_id')::uuid is distinct from auth.uid() then raise exception 'Unauthorized' using errcode='42501'; end if;
 if jsonb_typeof(p_lessons)<>'array' or jsonb_array_length(p_lessons)<1 or jsonb_array_length(p_lessons)>500 then raise exception 'Invalid lesson list' using errcode='22023'; end if;
 if p_track->>'goal_type' not in ('minutes','videos') or coalesce((p_track->>'daily_goal')::integer,0)<1 or (p_track->>'daily_goal')::integer>1440 then raise exception 'Invalid daily goal' using errcode='22023'; end if;
 insert into public.tracks(user_id,title,description,playlist_id,thumbnail_url,goal_type,daily_goal) values(auth.uid(),left(coalesce(p_track->>'title','Untitled playlist'),500),left(p_track->>'description',5000),p_track->>'playlist_id',p_track->>'thumbnail_url',p_track->>'goal_type',(p_track->>'daily_goal')::integer) returning * into new_track;
 insert into public.lessons(track_id,youtube_id,title,duration_seconds,position,thumbnail_url)
 select new_track.id,item->>'youtube_id',left(coalesce(item->>'title','Untitled lesson'),500),greatest(0,coalesce((item->>'duration_seconds')::integer,0)),greatest(0,coalesce((item->>'position')::integer,0)),item->>'thumbnail_url'
 from jsonb_array_elements(p_lessons) item where item->>'youtube_id' ~ '^[A-Za-z0-9_-]{11}$';
 if not found then raise exception 'No valid lessons supplied' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(l) order by l.position),'[]'::jsonb) into new_lessons from public.lessons l where l.track_id=new_track.id;
 return jsonb_build_object('track',to_jsonb(new_track),'lessons',new_lessons);
end; $$;

create table if not exists public.playlist_import_limits(user_id uuid primary key references auth.users(id) on delete cascade,window_started_at timestamptz not null default now(),request_count integer not null default 0 check(request_count>=0));
alter table public.playlist_import_limits enable row level security;
revoke all on public.playlist_import_limits from anon,authenticated;
create or replace function public.consume_playlist_import_limit(p_user_id uuid,p_limit integer default 10,p_window_seconds integer default 3600)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare current_count integer;
begin
 if auth.uid() is null or auth.uid() is distinct from p_user_id then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_limit<1 or p_limit>100 or p_window_seconds<60 or p_window_seconds>86400 then raise exception 'Invalid rate limit configuration' using errcode='22023'; end if;
 insert into public.playlist_import_limits(user_id,window_started_at,request_count) values(p_user_id,now(),1)
 on conflict(user_id) do update set request_count=case when playlist_import_limits.window_started_at<=now()-make_interval(secs=>p_window_seconds) then 1 else playlist_import_limits.request_count+1 end,window_started_at=case when playlist_import_limits.window_started_at<=now()-make_interval(secs=>p_window_seconds) then now() else playlist_import_limits.window_started_at end returning request_count into current_count;
 return current_count<=p_limit;
end; $$;
revoke all on function public.consume_playlist_import_limit(uuid,integer,integer) from public,anon;
grant execute on function public.consume_playlist_import_limit(uuid,integer,integer) to authenticated;
revoke all on function public.create_track_with_lessons(jsonb,jsonb) from public,anon;
grant execute on function public.create_track_with_lessons(jsonb,jsonb) to authenticated;
