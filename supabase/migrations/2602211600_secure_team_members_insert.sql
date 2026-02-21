-- team_members への直接 INSERT を禁止し、招待コード経由の参加のみ許可

drop policy if exists "team_members_insert" on team_members;

create or replace function join_team_by_invite_code(p_invite_code text)
returns uuid as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select id into v_team_id
  from teams
  where invite_code = p_invite_code;

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
