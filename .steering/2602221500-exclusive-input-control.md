# 排他制御の実装（Step 5）

## 概要

1試合につき1人だけが入力できる排他制御を実装する。
`game_input_sessions` / `game_input_requests` テーブルは既に存在し、Realtime も seed.sql で有効化済み。

## 作業内容

### 新規作成ファイル

- `hooks/useGameSession.ts` — 排他制御フック（セッション取得・ハートビート・申請・承認）
- `components/game/InputLockBanner.tsx` — 他者入力中バナー（Alert使用）
- `components/game/SessionRequestModal.tsx` — 申請通知モーダル（Dialog使用）
- `app/(main)/team/[id]/sessions/` — 管理者強制解除用のUI（team page内セクション追加）

### 変更ファイル

- `app/(main)/games/[id]/input/page.tsx` — useGameSession を組み込み、ロック時は InputLockBanner 表示
- `app/(main)/games/actions.ts` — セッション関連の Server Actions 追加（release, approve, reject, forceRelease）
- `app/(main)/team/[id]/page.tsx` — 管理者向け「入力セッション管理」セクション追加
- `app/(main)/team/actions.ts` — forceReleaseSession Server Action 追加

### shadcn/ui コンポーネント追加

- `alert` コンポーネントのインストールが必要（未インストール）

## 実装メモ

### セッション取得フロー

1. 入力画面に入ったとき `game_input_sessions` を確認
2. セッションなし → 自分のセッションを作成して入力開始
3. 自分のセッション → そのまま入力継続
4. 他者のセッション（5分以内） → InputLockBanner 表示
5. 他者のセッション（5分超） → InputLockBanner + 申請ボタン表示

### ハートビート

- `isMySession=true` の間、5秒ごとに `last_active_at` を更新
- `useEffect` のクリーンアップでセッションを削除

### タイムアウト

- `pending` 状態の申請が60秒経過したら自動承認
- `useEffect` 内で `setInterval` で監視

### Realtime

- `game_input_sessions` と `game_input_requests` の変更をリアルタイムで監視
- ブラウザ側 Supabase Client (`lib/supabase/client.ts`) で channel を subscribe

### DB スキーマ

game_input_sessions: id, game_id (UNIQUE), profile_id, last_active_at, created_at
game_input_requests: id, game_id, requester_id, status (pending/approved/rejected/timeout), created_at
profiles: id, display_name, created_at

### Server Actions の設計

セッション操作はブラウザ Supabase Client から直接行う（Server Actions不要のケース）:
- セッション作成: `supabase.from('game_input_sessions').insert(...)`
- ハートビート: `supabase.from('game_input_sessions').update({ last_active_at: ... })`
- セッション削除: `supabase.from('game_input_sessions').delete().eq('game_id', ...)`
- 申請作成: `supabase.from('game_input_requests').insert(...)`
- 申請承認/拒否: `supabase.from('game_input_requests').update({ status: ... })`

管理者強制解除のみ Server Action で実装（admin 権限チェックが必要）:
- `forceReleaseSessionAction(gameId, teamId)` — admin チェック後にセッション削除

## 完了要件チェックリスト

- [x] shadcn/ui の Alert コンポーネントをインストール
- [x] `hooks/useGameSession.ts` を作成（セッション取得・ハートビート・Realtime監視・申請/承認/拒否）
- [x] `components/game/InputLockBanner.tsx` を作成
- [x] `components/game/SessionRequestModal.tsx` を作成
- [x] `app/(main)/games/[id]/input/page.tsx` に排他制御を組み込む
- [x] `app/(main)/team/[id]/page.tsx` に管理者向けセッション管理セクションを追加
- [x] `app/(main)/team/actions.ts` に `forceReleaseSessionAction` を追加
- [x] 入力画面に入るとセッションが作成される
- [x] 他者のセッションがある場合はロックバナーが表示される
- [x] 5分操作なしで申請ボタンが表示される
- [x] 申請すると入力者にモーダルが表示される
- [x] 承認するとセッションが移譲される
- [x] 60秒無応答で自動承認される
- [x] 管理者が強制解除できる
- [x] 画面を離れるとセッションが削除される
- [x] `useGameSession` のユニットテストを作成
