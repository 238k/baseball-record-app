-- join_team_by_invite_code が teams_select RLS によって非メンバーのチームを
-- 見つけられない問題を修正。
-- teams_select ポリシーは "自分がメンバーまたはオーナーのチームのみ" に限定されているため、
-- まだ参加していないチームは通常の SELECT で見えない。
-- get_my_team_ids() と同じ STABLE SQL SECURITY DEFINER パターンで RLS をバイパスする。

create or replace function get_team_id_by_invite_code(p_invite_code text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from teams where invite_code = p_invite_code
$$;

-- join_team_by_invite_code を更新して上記ヘルパーを使用
create or replace function join_team_by_invite_code(p_invite_code text)
returns uuid as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- SECURITY DEFINER SQL ヘルパー経由で teams_select RLS をバイパスしてチームを検索
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

grant execute on function get_team_id_by_invite_code(text) to authenticated;
