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
