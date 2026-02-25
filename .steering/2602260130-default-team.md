# デフォルトチーム設定機能

## 概要

ユーザーが複数チームに所属する場合、デフォルトチームを設定できるようにする。
マイチーム画面ではデフォルトチームの詳細を初期表示し、プルダウンで切り替え可能にする。
新規試合登録画面ではデフォルトチームが初期選択される。

## 作業内容

### 新規作成ファイル
- `supabase/migrations/2602260130_add_default_team_id.sql` — profiles に default_team_id カラム追加
- `components/team/TeamSwitcher.tsx` — チーム切替プルダウン（Client Component）

### 変更ファイル
- `lib/supabase/types.ts` — 型再生成（`pnpm supabase:gen-types`）
- `app/(main)/teams/page.tsx` — TeamCard 一覧をやめ、デフォルトチームの詳細を初期表示 + プルダウンで切替
- `app/(main)/games/new/page.tsx` — デフォルトチームを fetch して初期選択
- `app/(main)/settings/page.tsx` — デフォルトチーム設定 UI を追加
- `app/(main)/settings/actions.ts` — `updateDefaultTeamAction` を追加
- `app/(main)/settings/actions.test.ts` — 新アクションのテスト追加

## 実装メモ

- `default_team_id` は nullable FK（`on delete set null`）。チーム脱退時に自動 null 化。
- マイチーム画面はサーバーコンポーネント + クライアントの TeamSwitcher に変更。
  - サーバーで全チーム一覧 + default_team_id + デフォルトチーム詳細を取得し、クライアントへ props で渡す。
  - TeamSwitcher がプルダウンで選択変更 → router.push(`/teams?team={id}`) でサーバー再レンダリング。
  - URLパラメータがなければ default_team_id、それもなければ先頭チームを表示。
- 新規試合登録画面は profiles から default_team_id を取得して初期値に使う。
- settings 画面に Select コンポーネントでデフォルトチーム選択を追加。

## 完了要件チェックリスト

- [x] マイグレーション作成（profiles.default_team_id nullable FK）
- [x] 型定義再生成
- [x] settings アクション追加（updateDefaultTeamAction）
- [x] settings アクションのテスト追加
- [x] settings 画面にデフォルトチーム選択 UI 追加
- [x] TeamSwitcher コンポーネント作成
- [x] マイチーム画面をデフォルトチーム初期表示 + プルダウン切替に変更
- [x] 新規試合登録画面でデフォルトチームを初期選択
- [x] pnpm build 成功
- [x] pnpm test 全テスト通過
