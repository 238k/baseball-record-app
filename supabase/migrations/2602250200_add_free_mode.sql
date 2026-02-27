-- Free Mode: allow games without a team
-- Adds created_by, is_free_mode, home_team_name, visitor_team_name to games
-- Makes team_id nullable for free-mode games

-- =====================================================
-- 1. Add new columns
-- =====================================================
alter table games
  add column created_by uuid references auth.users(id),
  add column is_free_mode boolean not null default false,
  add column home_team_name text,
  add column visitor_team_name text;

-- =====================================================
-- 2. Backfill created_by from teams.owner_id
-- =====================================================
update games g
set created_by = t.owner_id
from teams t
where g.team_id = t.id;

-- Make created_by NOT NULL after backfill
alter table games alter column created_by set not null;

-- =====================================================
-- 3. Make team_id nullable
-- =====================================================
alter table games alter column team_id drop not null;

-- =====================================================
-- 4. CHECK constraints
-- =====================================================
-- Team game: team_id required, opponent_name required
-- Free mode: team_id null, both team names required
alter table games add constraint games_mode_check check (
  (is_free_mode = false and team_id is not null)
  or
  (is_free_mode = true and team_id is null and home_team_name is not null and visitor_team_name is not null)
);

-- =====================================================
-- 5. Replace RLS policy on games
-- =====================================================
drop policy "games_all" on games;

create policy "games_all" on games for all
  using (
    -- Team games: member of the team
    (is_free_mode = false and team_id in (
      select team_id from team_members where profile_id = auth.uid()
    ))
    or
    -- Free-mode games: creator
    (is_free_mode = true and created_by = auth.uid())
  );

-- =====================================================
-- 6. Replace RLS policies on child tables
-- =====================================================

-- Helper: create a function so child tables can reuse the access check
-- (avoids duplicating the full condition in every policy)
create or replace function public.can_access_game(gid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from games g
    where g.id = gid
    and (
      (g.is_free_mode = false and g.team_id in (
        select tm.team_id from team_members tm where tm.profile_id = auth.uid()
      ))
      or
      (g.is_free_mode = true and g.created_by = auth.uid())
    )
  );
$$;

-- game_input_sessions
drop policy "sessions_all" on game_input_sessions;
create policy "sessions_all" on game_input_sessions for all
  using (public.can_access_game(game_id));

-- game_input_requests
drop policy "requests_all" on game_input_requests;
create policy "requests_all" on game_input_requests for all
  using (public.can_access_game(game_id));

-- lineups
drop policy "lineups_all" on lineups;
create policy "lineups_all" on lineups for all
  using (public.can_access_game(game_id));

-- at_bats
drop policy "at_bats_all" on at_bats;
create policy "at_bats_all" on at_bats for all
  using (public.can_access_game(game_id));

-- pitches (through at_bats)
drop policy "pitches_all" on pitches;
create policy "pitches_all" on pitches for all
  using (at_bat_id in (
    select id from at_bats where public.can_access_game(game_id)
  ));

-- base_runners
drop policy "base_runners_all" on base_runners;
create policy "base_runners_all" on base_runners for all
  using (public.can_access_game(game_id));

-- runner_events (through at_bats)
drop policy "runner_events_all" on runner_events;
create policy "runner_events_all" on runner_events for all
  using (at_bat_id in (
    select id from at_bats where public.can_access_game(game_id)
  ));

-- pitching_records
drop policy "pitching_records_all" on pitching_records;
create policy "pitching_records_all" on pitching_records for all
  using (public.can_access_game(game_id));

-- =====================================================
-- 7. Exclude free-mode from career stats views
-- =====================================================
create or replace view v_batter_career_stats as
select
  l.player_id,
  p.name,
  p.number,
  p.team_id,
  count(distinct ab.game_id) as games,
  count(*) filter (where ab.result is not null) as plate_appearances,
  count(*) filter (where ab.result not in ('BB','IBB','HBP','SH','SF') and ab.result is not null) as at_bats,
  count(*) filter (where ab.result in ('1B','2B','3B','HR')) as hits,
  count(*) filter (where ab.result = '2B') as doubles,
  count(*) filter (where ab.result = '3B') as triples,
  count(*) filter (where ab.result = 'HR') as home_runs,
  count(*) filter (where ab.result in ('BB','IBB')) as walks,
  count(*) filter (where ab.result = 'HBP') as hit_by_pitch,
  count(*) filter (where ab.result = 'SF') as sac_flies,
  count(*) filter (where ab.result in ('K','KK')) as strikeouts,
  coalesce(sum(ab.rbi), 0) as rbi,
  (
    count(*) filter (where ab.result = '1B') * 1 +
    count(*) filter (where ab.result = '2B') * 2 +
    count(*) filter (where ab.result = '3B') * 3 +
    count(*) filter (where ab.result = 'HR') * 4
  ) as total_bases,
  count(distinct re.id) filter (where re.event_type = 'scored') as runs,
  count(distinct re2.id) filter (where re2.event_type = 'stolen_base') as stolen_bases,
  count(distinct re2.id) filter (where re2.event_type = 'caught_stealing') as caught_stealing
from at_bats ab
join lineups l on l.id = ab.lineup_id
join players p on p.id = l.player_id
join games g on g.id = ab.game_id
left join runner_events re on re.lineup_id = ab.lineup_id
  and re.at_bat_id = ab.id and re.event_type = 'scored'
left join runner_events re2 on re2.lineup_id = ab.lineup_id
  and re2.at_bat_id = ab.id
where g.is_free_mode = false
group by l.player_id, p.name, p.number, p.team_id;

create or replace view v_pitcher_career_stats as
select
  l.player_id,
  p.name,
  p.number,
  p.team_id,
  count(distinct pr.game_id) as games,
  sum(pr.outs_recorded) as outs_recorded,
  sum(pr.hits) as hits,
  sum(pr.runs) as runs,
  sum(pr.earned_runs) as earned_runs,
  sum(pr.walks) as walks,
  sum(pr.strikeouts) as strikeouts,
  (sum(pr.outs_recorded) / 3)::text || '.' || (sum(pr.outs_recorded) % 3)::text as innings_pitched,
  case
    when sum(pr.outs_recorded) = 0 then null
    else round((sum(pr.earned_runs)::numeric * 27 / sum(pr.outs_recorded)), 2)
  end as era
from pitching_records pr
join lineups l on l.id = pr.lineup_id
join players p on p.id = l.player_id
join games g on g.id = pr.game_id
where g.is_free_mode = false
group by l.player_id, p.name, p.number, p.team_id;

-- Re-apply security_invoker (CREATE OR REPLACE resets it)
alter view v_batter_career_stats set (security_invoker = true);
alter view v_pitcher_career_stats set (security_invoker = true);
