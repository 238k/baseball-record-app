-- team_members の SELECT ポリシーが自己参照して無限再帰を起こす問題を修正
-- security definer 関数でRLSをバイパスしてユーザーのチームIDを取得する

create or replace function get_my_team_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select team_id from team_members where profile_id = auth.uid()
$$;

-- team_members の自己参照ポリシーを修正
drop policy "team_members_select" on team_members;
create policy "team_members_select" on team_members for select
  using (team_id in (select get_my_team_ids()));

-- 他テーブルのポリシーも同じ再帰を起こすので修正
drop policy "teams_select" on teams;
create policy "teams_select" on teams for select
  using (id in (select get_my_team_ids()));

drop policy "players_all" on players;
create policy "players_all" on players for all
  using (team_id in (select get_my_team_ids()));

drop policy "games_all" on games;
create policy "games_all" on games for all
  using (team_id in (select get_my_team_ids()));

drop policy "sessions_all" on game_input_sessions;
create policy "sessions_all" on game_input_sessions for all
  using (game_id in (select id from games where team_id in (select get_my_team_ids())));

drop policy "requests_all" on game_input_requests;
create policy "requests_all" on game_input_requests for all
  using (game_id in (select id from games where team_id in (select get_my_team_ids())));

drop policy "lineups_all" on lineups;
create policy "lineups_all" on lineups for all
  using (game_id in (select id from games where team_id in (select get_my_team_ids())));

drop policy "at_bats_all" on at_bats;
create policy "at_bats_all" on at_bats for all
  using (game_id in (select id from games where team_id in (select get_my_team_ids())));

drop policy "pitches_all" on pitches;
create policy "pitches_all" on pitches for all
  using (at_bat_id in (
    select id from at_bats where game_id in (
      select id from games where team_id in (select get_my_team_ids())
    )
  ));
