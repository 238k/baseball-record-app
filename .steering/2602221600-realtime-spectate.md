# リアルタイム観戦画面（Step 6）

## 概要

試合詳細画面 (`/games/[id]`) を試合状況がリアルタイムで自動更新される観戦画面に仕上げる。
入力画面 (`/games/[id]/input`) でデータが更新されると、Supabase Realtime 経由で観戦画面が自動で最新状態を反映する。

## 前提

- Realtime 用テーブル（`at_bats`, `base_runners`, `runner_events`, `games`, `game_input_sessions`）は seed.sql で有効化済み
- `useGameState` フックは既にゲーム状態の再構築ロジックを持っている（再利用する）

## 作業内容

### 新規作成ファイル

- `hooks/useRealtimeGame.ts` — Realtime 購読フック。`useGameState` の reload を Realtime イベントで自動呼び出しする。追加で `v_scoreboard` のイニング別スコアと `game_input_sessions` の入力者情報も管理する
- `components/game/InningScoreTable.tsx` — イニング別スコアテーブル（v_scoreboard ビューのデータを表示）
- `components/game/RecentAtBatLog.tsx` — 直近の打席結果ログ表示
- `app/(main)/games/[id]/spectate/page.tsx` — 観戦画面（Client Component）

### 変更ファイル

- `app/(main)/games/[id]/page.tsx` — 試合中の場合に「観戦する」ボタンを追加（終了済も含む）

## 実装メモ

### アーキテクチャ判断

現在の `app/(main)/games/[id]/page.tsx` はサーバーコンポーネントとしてオーダー表示を行っている。
仕様の「試合詳細画面を観戦画面に仕上げる」について、既存の SSR ページはオーダー表示として残し、
Realtime観戦は別ルート `/games/[id]/spectate` として分離する。理由：
- サーバーコンポーネントでは Realtime が使えない
- オーダー登録フローへの導線が既存ページに必要
- 分離することで観戦画面のクライアントバンドルがオーダー表示に影響しない

### useRealtimeGame フック

- `useGameState` の `reload` をラップし、Realtime チャネル購読で自動 reload
- 追加で以下を管理：
  - `inningScores`: `v_scoreboard` から取得したイニング別スコア
  - `inputHolder`: `game_input_sessions` + `profiles` から取得した現在の入力者名
  - `recentAtBats`: 最新5件程度の打席結果ログ（at_bats + lineups の join）

### Realtime 購読対象

- `at_bats` (filter: `game_id=eq.{gameId}`)
- `base_runners` — filter 不可（game_id なし）。at_bats の変更時に合わせて再取得
- `runner_events` — 同上
- `games` (filter: `id=eq.{gameId}`)
- `game_input_sessions` (filter: `game_id=eq.{gameId}`)

→ 実際には at_bats / games / game_input_sessions の3テーブルの変更をトリガーに reload すれば
  base_runners / runner_events は useGameState.reload で一括取得される。

### v_scoreboard ビューの構造

```
game_id, inning, inning_half, runs
```
inning_half は 'top' / 'bottom'。runs は scored イベント数。

### 結果コードの日本語ラベルマッピング

AtBatInput の RESULT_GROUPS を参考に共通ユーティリティとして使う。

## 完了要件チェックリスト

- [x] `hooks/useRealtimeGame.ts` を作成（useGameState + Realtime 購読 + v_scoreboard + inputHolder + recentAtBats）
- [x] `components/game/InningScoreTable.tsx` を作成（イニング別スコアテーブル）
- [x] `components/game/RecentAtBatLog.tsx` を作成（直近の打席結果ログ）
- [x] `app/(main)/games/[id]/spectate/page.tsx` を作成（観戦画面 UI）
- [x] `app/(main)/games/[id]/page.tsx` に「観戦する」ボタンを追加
- [x] 記録入力画面で結果を入力すると観戦画面が自動更新される
- [x] スコアが正しく表示される
- [x] イニング別スコアが表示される
- [x] 走者状況がリアルタイムで更新される
- [x] 直近の打席結果ログが表示される
- [x] 入力者の名前が表示される
- [x] pnpm lint 通過
- [x] pnpm build 成功
