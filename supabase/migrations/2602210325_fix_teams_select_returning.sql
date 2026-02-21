-- teams の INSERT + RETURNING が RLS 42501 で失敗する問題を修正
-- 原因: PostgreSQL は RETURNING を AFTER トリガーより先に評価する
--   1. INSERT WITH CHECK → 通過
--   2. RETURNING 評価 → teams_select USING が発動 → team_members にまだ行がない
--      (on_team_created トリガーが未発火) → 0 行 → PostgREST が 42501 で返す
--   3. AFTER トリガー on_team_created → team_members に追加
-- 修正: owner_id = auth.uid() を OR 条件に追加し、
--       owner は team_members 経由でなくても直接チームを参照できるようにする

drop policy if exists "teams_select" on teams;
create policy "teams_select" on teams for select
  using (
    owner_id = auth.uid()
    or id in (select get_my_team_ids())
  );
