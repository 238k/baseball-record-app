# 試合管理・UX 改善（Step 11）

## 概要

試合の編集・削除機能、プロフィール設定画面を追加し、各種 UX を改善する。

## 作業内容

### 新規作成ファイル

- `app/(main)/games/[id]/edit/page.tsx` — 試合情報編集ページ（Client Component）
- `app/(main)/settings/page.tsx` — プロフィール設定ページ（Client Component）
- `app/(main)/settings/actions.ts` — `updateProfileAction`
- `app/(main)/settings/actions.test.ts` — updateProfileAction テスト
- `components/game/GameActionButtons.tsx` — 試合詳細ページ用のクライアント操作ボタン（削除・試合開始）

### 変更ファイル

- `app/(main)/games/actions.ts` — `updateGameAction`, `deleteGameAction` を追加
- `app/(main)/games/actions.test.ts` — 新 Action のテスト追加
- `app/(main)/games/[id]/page.tsx` — 編集/削除ボタン追加、試合開始ボタン追加
- `app/(main)/games/[id]/spectate/page.tsx` — finished 時に「試合成績を見る」リンク追加
- `app/(main)/layout.tsx` — ヘッダーに設定リンク（歯車アイコン）追加

## 実装メモ

### 試合編集

- `scheduled` ステータスの試合のみ編集可能
- 試合作成ページ（`games/new/page.tsx`）のフォームをベースに、既存値を初期値としてセット
- チーム選択は不要（変更不可）。相手チーム名、日付、場所、ホーム/ビジター、イニング数、DH制を編集可能
- `updateGameAction` で games テーブルを UPDATE

### 試合削除

- `scheduled` ステータスの試合のみ削除可能
- `AlertDialog` で確認後に削除実行
- DB の CASCADE 設定により関連データ（lineups, pitching_records, at_bats 等）は自動削除
- 削除後はトップページにリダイレクト

### 試合開始ボタン

- 既存の `startGameAction` を使用
- `scheduled` かつオーダー登録済み（lineups が存在する）場合のみ表示
- ゲーム詳細ページは Server Component なので、操作ボタンは Client Component として分離

### プロフィール設定

- `profiles` テーブルの `display_name` を更新
- RLS ポリシーで本人のみ UPDATE 可能（`auth.uid() = id`）

### 観戦画面の導線改善

- `finished` ステータス時に「試合成績を見る」リンクを追加（`/games/[id]` の成績タブへ遷移）

## 完了要件チェックリスト

- [x] `updateGameAction` を実装し、scheduled の試合情報を更新できる
- [x] `deleteGameAction` を実装し、scheduled の試合を削除できる
- [x] 試合編集ページ `/games/[id]/edit` を作成する
- [x] 試合詳細ページに編集・削除・試合開始ボタンを追加する
- [x] `updateProfileAction` を実装する
- [x] プロフィール設定ページ `/settings` を作成する
- [x] ヘッダーに設定リンク（歯車アイコン）を追加する
- [x] 観戦画面に `finished` 時「試合成績を見る」リンクを追加する
- [x] `updateGameAction`, `deleteGameAction` のユニットテストを追加する
- [x] `updateProfileAction` のユニットテストを追加する
- [x] `pnpm lint && pnpm build && pnpm test` がパスする
