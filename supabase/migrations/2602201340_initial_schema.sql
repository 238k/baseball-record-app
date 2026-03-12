-- =====================================================
-- 野球試合記録アプリ Supabase 統合スキーマ定義
-- 16個のマイグレーションファイルを統合 (2026-03-13)
-- =====================================================

-- =====================================================
-- profiles
-- =====================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  default_team_id uuid,  -- FK は teams 作成後に追加
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================
-- teams
-- =====================================================
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id) on delete restrict,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

-- profiles.default_team_id FK (teams が作成された後)
alter table profiles
  add constraint profiles_default_team_id_fkey
  foreign key (default_team_id) references teams(id) on delete set null;

-- =====================================================
-- team_members
-- =====================================================
create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'member')) default 'member',
  created_at timestamptz not null default now(),
  unique (team_id, profile_id)
);

create or replace function handle_new_team()
returns trigger as $$
begin
  insert into team_members (team_id, profile_id, role)
  values (new.id, new.owner_id, 'admin');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_team_created
  after insert on teams
  for each row execute function handle_new_team();

-- =====================================================
-- players
-- =====================================================
create table players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  number text,
  position text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =====================================================
-- games
-- =====================================================
create table games (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  is_free_mode boolean not null default false,
  opponent_name text not null,
  game_date date not null,
  location text,
  is_home boolean not null default true,
  status text not null check (status in ('scheduled', 'in_progress', 'finished')) default 'scheduled',
  innings int not null default 9,
  use_dh boolean not null default false,
  home_team_name text,
  visitor_team_name text,
  created_at timestamptz not null default now(),
  constraint games_mode_check check (
    (is_free_mode = false and team_id is not null)
    or
    (is_free_mode = true and team_id is null and home_team_name is not null and visitor_team_name is not null)
  )
);

-- =====================================================
-- game_input_sessions（排他制御）
-- =====================================================
create table game_input_sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade unique,
  profile_id uuid not null references profiles(id) on delete cascade,
  current_pitch_log jsonb not null default '[]',
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- =====================================================
-- game_input_requests（入力権申請）
-- =====================================================
create table game_input_requests (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  requester_id uuid not null references profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'approved', 'rejected', 'timeout')) default 'pending',
  created_at timestamptz not null default now()
);

-- =====================================================
-- lineups（オーダー）
-- =====================================================
create table lineups (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_side text not null check (team_side in ('home', 'visitor')),
  batting_order int not null check (batting_order between 1 and 9),
  player_id uuid references players(id) on delete set null,
  player_name text,
  position text,
  inning_from int not null default 1,
  created_at timestamptz not null default now(),
  constraint player_name_required check (player_id is not null or player_name is not null)
);

-- =====================================================
-- at_bats（打席）
-- =====================================================
create table at_bats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  inning int not null,
  inning_half text not null check (inning_half in ('top', 'bottom')),
  batting_order int not null,
  lineup_id uuid not null references lineups(id) on delete restrict,
  pitch_count int not null default 0,
  result text check (result in (
    '1B','2B','3B','HR',
    'BB','IBB','HBP',
    'K','KK',
    'GO','FO','LO',
    'DP','SF','SH',
    'FC','E'
  )),
  rbi int not null default 0,
  runners_after jsonb,
  recorded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =====================================================
-- pitches（投球）
-- =====================================================
create table pitches (
  id uuid primary key default gen_random_uuid(),
  at_bat_id uuid not null references at_bats(id) on delete cascade,
  pitch_number int not null,
  result text not null check (result in ('ball', 'swinging', 'looking', 'foul', 'hit', 'out')),
  created_at timestamptz not null default now()
);

-- =====================================================
-- base_runners（走者スナップショット）
-- =====================================================
create table base_runners (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  at_bat_id uuid not null references at_bats(id) on delete cascade,
  base text not null check (base in ('1st','2nd','3rd')),
  lineup_id uuid not null references lineups(id) on delete restrict,
  unique (at_bat_id, base)
);

-- =====================================================
-- runner_events（走塁イベント）
-- =====================================================
create table runner_events (
  id uuid primary key default gen_random_uuid(),
  at_bat_id uuid not null references at_bats(id) on delete cascade,
  lineup_id uuid not null references lineups(id) on delete restrict,
  event_type text not null check (event_type in ('stolen_base', 'caught_stealing', 'scored', 'out', 'wild_pitch', 'passed_ball', 'balk')),
  created_at timestamptz not null default now()
);

-- =====================================================
-- pitching_records（投手記録）
-- =====================================================
create table pitching_records (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  lineup_id uuid not null references lineups(id) on delete restrict,
  inning_from int not null,
  inning_to int,
  outs_recorded int not null default 0,
  hits int not null default 0,
  runs int not null default 0,
  earned_runs int not null default 0,
  walks int not null default 0,
  strikeouts int not null default 0,
  created_at timestamptz not null default now()
);

-- =====================================================
-- Helper Functions
-- =====================================================

-- RLS再帰回避: ユーザーのチームIDを取得
create or replace function get_my_team_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select team_id from team_members where profile_id = auth.uid()
$$;

-- 招待コードからチームID取得（RLSバイパス）
create or replace function get_team_id_by_invite_code(p_invite_code text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from teams where invite_code = p_invite_code
$$;

-- 試合アクセス権チェック（チーム試合 or フリーモード）
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

-- =====================================================
-- RPC Functions
-- =====================================================

-- 招待コードでチームに参加
create or replace function join_team_by_invite_code(p_invite_code text)
returns uuid as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_team_id := get_team_id_by_invite_code(p_invite_code);

  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  if exists (
    select 1 from team_members
    where team_id = v_team_id and profile_id = auth.uid()
  ) then
    raise exception 'already_member';
  end if;

  insert into team_members (team_id, profile_id, role)
  values (v_team_id, auth.uid(), 'member');

  return v_team_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function join_team_by_invite_code(text) to authenticated;
grant execute on function get_team_id_by_invite_code(text) to authenticated;

-- メンバーを管理者に昇格
create or replace function promote_team_member(p_member_id uuid)
returns void as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select team_id into v_team_id
  from team_members
  where id = p_member_id;

  if v_team_id is null then
    raise exception 'member_not_found';
  end if;

  if not exists (
    select 1 from team_members
    where team_id = v_team_id
      and profile_id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'not_authorized';
  end if;

  update team_members
  set role = 'admin'
  where id = p_member_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function promote_team_member(uuid) to authenticated;

-- 試合終了
create or replace function finish_game(p_game_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_status text;
  v_final_inning int;
begin
  select status into v_status from games where id = p_game_id;
  if v_status is null then
    raise exception 'Game not found';
  end if;
  if v_status <> 'in_progress' then
    raise exception 'Game is not in progress';
  end if;

  select coalesce(
    (select inning from at_bats where game_id = p_game_id order by created_at desc limit 1),
    9
  ) into v_final_inning;

  update pitching_records
  set inning_to = v_final_inning
  where game_id = p_game_id
    and inning_to is null;

  update games
  set status = 'finished'
  where id = p_game_id;
end;
$$;

-- =====================================================
-- 成績算出 VIEWs
-- =====================================================

-- 打者成績（試合単位）
create or replace view v_batter_game_stats as
select
  ab.game_id,
  ab.lineup_id,
  l.batting_order,
  l.player_id,
  l.player_name,
  coalesce(p.name, l.player_name) as name,
  p.number,
  count(*) filter (where ab.result is not null) as plate_appearances,
  count(*) filter (where ab.result not in ('BB','IBB','HBP','SH','SF') and ab.result is not null) as at_bats,
  count(*) filter (where ab.result in ('1B','2B','3B','HR')) as hits,
  count(*) filter (where ab.result = '1B') as singles,
  count(*) filter (where ab.result = '2B') as doubles,
  count(*) filter (where ab.result = '3B') as triples,
  count(*) filter (where ab.result = 'HR') as home_runs,
  count(*) filter (where ab.result in ('BB','IBB')) as walks,
  count(*) filter (where ab.result = 'HBP') as hit_by_pitch,
  count(*) filter (where ab.result = 'SH') as sac_bunts,
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
left join players p on p.id = l.player_id
left join runner_events re on re.lineup_id = ab.lineup_id
  and re.at_bat_id = ab.id and re.event_type = 'scored'
left join runner_events re2 on re2.lineup_id = ab.lineup_id
  and re2.at_bat_id = ab.id
group by ab.game_id, ab.lineup_id, l.batting_order, l.player_id, l.player_name, p.name, p.number;

-- 打者成績（通算・登録選手のみ、フリーモード除外）
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

-- 投手成績（試合単位）
create or replace view v_pitcher_game_stats as
select
  pr.game_id,
  pr.lineup_id,
  l.player_id,
  coalesce(p.name, l.player_name) as name,
  p.number,
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
left join players p on p.id = l.player_id
group by pr.game_id, pr.lineup_id, l.player_id, l.player_name, p.name, p.number;

-- 投手成績（通算・登録選手のみ、フリーモード除外）
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

-- スコアボード（イニング別得点）
create or replace view v_scoreboard as
select
  g.id as game_id,
  ab.inning,
  ab.inning_half,
  count(re.id) filter (where re.event_type = 'scored') as runs
from games g
join at_bats ab on ab.game_id = g.id
left join runner_events re on re.at_bat_id = ab.id and re.event_type = 'scored'
group by g.id, ab.inning, ab.inning_half
order by ab.inning, ab.inning_half;

-- Views に SECURITY INVOKER を設定
alter view v_batter_game_stats set (security_invoker = true);
alter view v_batter_career_stats set (security_invoker = true);
alter view v_pitcher_game_stats set (security_invoker = true);
alter view v_pitcher_career_stats set (security_invoker = true);
alter view v_scoreboard set (security_invoker = true);

-- =====================================================
-- Row Level Security
-- =====================================================
alter table profiles enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table players enable row level security;
alter table games enable row level security;
alter table game_input_sessions enable row level security;
alter table game_input_requests enable row level security;
alter table lineups enable row level security;
alter table at_bats enable row level security;
alter table pitches enable row level security;
alter table base_runners enable row level security;
alter table runner_events enable row level security;
alter table pitching_records enable row level security;

-- profiles
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- teams
create policy "teams_select" on teams for select
  using (
    owner_id = auth.uid()
    or id in (select get_my_team_ids())
  );
create policy "teams_insert" on teams for insert with check (owner_id = auth.uid());
create policy "teams_update" on teams for update using (owner_id = auth.uid());

-- team_members (INSERT は join_team_by_invite_code RPC 経由のみ)
create policy "team_members_select" on team_members for select
  using (team_id in (select get_my_team_ids()));
create policy "team_members_delete" on team_members for delete
  using (team_id in (select team_id from team_members where profile_id = auth.uid() and role = 'admin'));

-- players
create policy "players_all" on players for all
  using (team_id in (select get_my_team_ids()));

-- games (チーム試合 + フリーモード対応)
create policy "games_all" on games for all
  using (
    (is_free_mode = false and team_id in (
      select team_id from team_members where profile_id = auth.uid()
    ))
    or
    (is_free_mode = true and created_by = auth.uid())
  );

-- game_input_sessions
create policy "sessions_all" on game_input_sessions for all
  using (public.can_access_game(game_id));

-- game_input_requests
create policy "requests_all" on game_input_requests for all
  using (public.can_access_game(game_id));

-- lineups
create policy "lineups_all" on lineups for all
  using (public.can_access_game(game_id));

-- at_bats
create policy "at_bats_all" on at_bats for all
  using (public.can_access_game(game_id));

-- pitches
create policy "pitches_all" on pitches for all
  using (at_bat_id in (
    select id from at_bats where public.can_access_game(game_id)
  ));

-- base_runners
create policy "base_runners_all" on base_runners for all
  using (public.can_access_game(game_id));

-- runner_events
create policy "runner_events_all" on runner_events for all
  using (at_bat_id in (
    select id from at_bats where public.can_access_game(game_id)
  ));

-- pitching_records
create policy "pitching_records_all" on pitching_records for all
  using (public.can_access_game(game_id));

-- =====================================================
-- Realtime 有効化対象テーブル
-- Supabase ダッシュボード > Database > Replication で有効化
-- - game_input_sessions
-- - game_input_requests
-- - at_bats
-- - base_runners
-- - runner_events
-- - games
-- =====================================================
