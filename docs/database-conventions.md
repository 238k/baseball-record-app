# データベース設計規約

## インデックス

**FK列および頻繁に WHERE / JOIN で使われるカラムには必ずインデックスを作成する。**

```sql
-- FK列のインデックス（必須）
CREATE INDEX idx_at_bats_game_id ON at_bats(game_id);
CREATE INDEX idx_at_bats_lineup_id ON at_bats(lineup_id);
CREATE INDEX idx_lineups_game_id ON lineups(game_id);
CREATE INDEX idx_team_members_profile_id ON team_members(profile_id);
CREATE INDEX idx_runner_events_at_bat_id ON runner_events(at_bat_id);
CREATE INDEX idx_base_runners_at_bat_id ON base_runners(at_bat_id);
CREATE INDEX idx_pitching_records_game_id ON pitching_records(game_id);
CREATE INDEX idx_game_input_sessions_game_id ON game_input_sessions(game_id);

-- 複合インデックス（クエリパターンに応じて）
CREATE INDEX idx_at_bats_game_created ON at_bats(game_id, created_at DESC);
CREATE INDEX idx_lineups_game_side ON lineups(game_id, team_side);
```

新しいテーブルを追加する際は、FK列のインデックスを同じマイグレーション内で作成すること。

## CASCADE vs RESTRICT の判断基準

| 戦略 | 使う場面 | 例 |
|------|---------|-----|
| `CASCADE` | 親が消えたら子も不要 | `teams` → `players`（チーム削除で選手も削除） |
| `RESTRICT` | 子が存在する限り親の削除を防ぐ | `lineups` → `at_bats`（打席記録がある限りラインナップ削除不可） |
| `SET NULL` | 親が消えても子は残したい | `at_bats.recorded_by` → `profiles`（記録者が退会しても打席記録は残す） |

### 現状のポリシー

- `team_members`, `players`, `games` → 親テーブルに `CASCADE`
- `at_bats`, `base_runners`, `runner_events`, `pitching_records` → `lineups` に `RESTRICT`
  - 理由: 試合記録の保全（ラインナップを誤って削除しても記録を守る）
  - 注意: ゲームリセット時は子テーブルから順に削除する必要がある

## JSONB 列

**JSONB列には CHECK 制約またはトリガーで構造を検証する。**

```sql
-- 例: runners_after の構造検証
ALTER TABLE at_bats ADD CONSTRAINT check_runners_after
  CHECK (
    runners_after IS NULL
    OR (
      jsonb_typeof(runners_after) = 'array'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(runners_after) elem
        WHERE NOT (elem ? 'base' AND elem ? 'lineup_id')
      )
    )
  );
```

現状の JSONB 列:
- `at_bats.runners_after` — 打席後のランナー状況。構造: `[{base, lineup_id}]`
- `game_input_sessions.current_pitch_log` — 投球ログ。構造: `["B"|"S"|"F"|"X"]`

## 監査証跡（updated_at）

**主要テーブルには `updated_at` カラムと自動更新トリガーを追加する。**

```sql
-- カラム追加
ALTER TABLE games ADD COLUMN updated_at timestamptz DEFAULT now();

-- 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

対象テーブル: `games`, `lineups`, `at_bats`, `players`, `teams`, `profiles`

## マイグレーション命名規則

**形式: `YYMMDDHHMM_snake_case_description.sql`**

```
2602201340_initial_schema.sql
2602201800_fix_rls_recursion.sql
2602250100_fix_security_definer_views.sql
2602280100_add_finish_game_rpc.sql
```

- 年月日時分（JST）でプレフィックス
- snake_case で内容を簡潔に説明
- 1マイグレーション = 1つの論理的な変更

## RLS ポリシー

### 基本方針

- 全テーブルに RLS を有効化（`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`）
- ビューは `security_invoker = true` を使用（デフォルトの `SECURITY DEFINER` は使わない）
- 再帰的なポリシー参照は `SECURITY DEFINER` の補助関数で回避

### 現状の補助関数

- `get_my_team_ids()` — 自分が所属するチームIDリストを返す（RLS再帰防止）
- `can_access_game(game_id)` — 指定ゲームへのアクセス権判定
- `join_team_by_invite_code(code)` — 招待コードによるチーム参加（直接INSERTをRLSで禁止）

## 統計ビュー

統計は常に DB ビューから取得し、TypeScript 側で計算しない。

```
v_batter_game_stats    — 打者の試合別成績
v_batter_career_stats  — 打者の通算成績
v_pitcher_game_stats   — 投手の試合別成績
v_pitcher_career_stats — 投手の通算成績
v_scoreboard           — スコアボード
```

ビューのパフォーマンスが問題になった場合は `EXPLAIN ANALYZE` で確認し、必要に応じてインデックスを追加する。
