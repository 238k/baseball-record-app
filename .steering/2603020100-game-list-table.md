# 試合一覧を表形式で表示する

関連 issue: #7

## 概要

試合一覧ページ（`/games`）の表示を、現在のカード形式（`GameCard`）から Table 形式に変更する。試合数が増えた際の一覧性を向上させる。

## 現状

- `app/(main)/games/page.tsx` で `GameCard` を `grid gap-4` で並べている
- `GameCard` は Card コンポーネントでタイトル・日付・スコア・操作ボタンを表示
- `GameCard` はトップページ（今日の試合）でも使用されているため、削除せず残す

## 実装方針

### 新規作成ファイル

- `components/game/GameListTable.tsx` — テーブル形式の試合一覧コンポーネント
- `components/game/GameListTable.test.tsx` — テスト

### 変更ファイル

- `app/(main)/games/page.tsx` — `GameCard` の代わりに `GameListTable` を使用

### テーブルカラム

| カラム | 内容 |
|--------|------|
| 日付 | game_date |
| 対戦 | vs opponent_name / home vs visitor (フリーモード) |
| スコア | myScore - opponentScore（finished/in_progress のみ） |
| 状態 | Badge（準備中/準備完了/LIVE/試合終了） |
| 操作 | 詳細リンク + 記録/編集ボタン（状態に応じて） |

### 設計判断

- shadcn/ui の Table コンポーネントを使用
- テーブル行全体をクリック可能にはせず、操作カラムにリンクボタンを配置（タブレットでの誤タップ防止）
- モバイルでは横スクロール対応
- `GameCard` コンポーネントは削除しない（今日の試合で引き続き使用される可能性がある）

## 完了要件チェックリスト

- [x] GameListTable コンポーネントを作成する
- [x] games/page.tsx で GameListTable を使用する
- [x] GameListTable のテストを作成する（11テスト）
- [x] pnpm test が全件パスする（268テスト）
