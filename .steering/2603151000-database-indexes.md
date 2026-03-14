# データベースインデックスの追加

関連 issue: #17

## 概要

FK列にインデックスが未定義のため、データ増加に伴いクエリ性能が低下するリスクがある。
全FK列およびクエリで頻繁に使われるカラムにインデックスを追加する。

## 作業内容

### 単一カラムインデックス（FK列）

- `at_bats.game_id`
- `at_bats.lineup_id`
- `lineups.game_id`
- `team_members.profile_id`
- `runner_events.at_bat_id`
- `base_runners.at_bat_id`
- `pitching_records.game_id`
- `pitching_records.lineup_id`
- `pitches.at_bat_id`
- `players.team_id`
- `games.team_id`
- `games.created_by`
- `game_input_requests.game_id`
- `game_input_requests.requester_id`
- `game_input_sessions.profile_id`
- `base_runners.game_id`
- `base_runners.lineup_id`
- `at_bats.recorded_by`

注: `game_input_sessions.game_id` は UNIQUE 制約が既にあるためインデックス不要。

### 複合インデックス

- `at_bats(game_id, created_at DESC)` — 試合の全打席を時系列で取得
- `lineups(game_id, team_side)` — 試合のチーム別ラインナップ取得

## チェックリスト

- [x] マイグレーションファイル作成
- [x] `pnpm supabase:reset` で適用確認
- [x] 全インデックスの存在確認（21インデックス）
