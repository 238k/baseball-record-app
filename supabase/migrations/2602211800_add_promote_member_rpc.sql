-- team_members に UPDATE ポリシーが存在しないため、
-- 直接 UPDATE で誰でも role を変更できる問題を修正。
-- SECURITY DEFINER 関数で呼び出し元の admin 権限をサーバー側で強制する。

create or replace function promote_team_member(p_member_id uuid)
returns void as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- 対象メンバーのチームIDを取得
  select team_id into v_team_id
  from team_members
  where id = p_member_id;

  if v_team_id is null then
    raise exception 'member_not_found';
  end if;

  -- 呼び出し元がそのチームの admin であることを確認
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
