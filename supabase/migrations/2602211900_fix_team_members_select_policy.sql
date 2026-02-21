-- team_members_select ポリシーを修正: 自分のレコードのみ → 同チームのメンバー全員を閲覧可能に
-- get_my_team_ids() は SECURITY DEFINER で RLS を回避するため、再帰問題を回避できる
DROP POLICY IF EXISTS team_members_select ON team_members;
CREATE POLICY team_members_select ON team_members
  FOR SELECT USING (team_id IN (SELECT get_my_team_ids()));
