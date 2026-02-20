# 認証・チーム管理・選手登録（Step 1）

## 概要

野球試合記録アプリの基盤となる認証・チーム管理・選手登録機能の実装。
タブレット（iPad）での操作を主に想定。shadcn/ui を使用し、タップしやすい大きめのUIを提供する。

参考仕様: `docs/step1_auth_team_players.md`

## 作業内容

### Supabase セットアップ

- `supabase/migrations/2602201340_initial_schama.sql` — Supabase MCPで適用済み

### 新規作成ファイル

- `lib/supabase/types.ts` — Supabase MCP経由で自動生成した型定義
- `lib/supabase/client.ts` — ブラウザ用Supabaseクライアント（Client Components用）
- `lib/supabase/server.ts` — サーバー用Supabaseクライアント（Server Components・Server Actions用）
- `proxy.ts` — 認証チェック・未認証時 `/login` リダイレクト（Next.js 16では `middleware.ts` → `proxy.ts`）
- `components/auth/AuthForm.tsx` — ログイン・新規登録共用フォーム（Google OAuth + メール/パスワード）
- `app/(auth)/login/page.tsx` — ログイン画面
- `app/(auth)/register/page.tsx` — 新規登録画面
- `app/(main)/layout.tsx` — 認証済みページ共通レイアウト（ヘッダー・ログアウト）
- `app/(main)/page.tsx` — トップ画面（チーム一覧・チーム作成/参加）
- `app/(main)/team/new/page.tsx` — チーム作成フォーム
- `app/(main)/team/[id]/page.tsx` — チーム管理トップ（admin: 名前編集ボタン表示）
- `app/(main)/team/[id]/players/page.tsx` — 選手一覧・登録・編集・引退（Client Component）
- `app/(main)/team/[id]/invite/page.tsx` — 招待コード・メンバー管理（Client Component）
- `components/team/TeamCard.tsx` — チーム一覧カード
- `components/team/JoinTeamDialog.tsx` — 招待コードでチーム参加ダイアログ
- `components/team/EditTeamNameDialog.tsx` — チーム名編集ダイアログ（admin専用）
- `components/team/PlayerForm.tsx` — 選手追加・編集ダイアログ
- `components/team/MemberList.tsx` — メンバー一覧（昇格・削除ボタン含む）

### 変更ファイル

- `app/layout.tsx` — タイトル・説明を野球アプリ用に変更
- `app/page.tsx` — ボイラープレートを削除（`(main)/page.tsx` がルートを担当）

### インストール済み shadcn/ui コンポーネント

button, input, label, card, dialog, select, tabs, badge, avatar, separator

## 実装メモ

- **Next.js 16 の変更**: `middleware.ts` が `proxy.ts` に改名され、エクスポート関数も `proxy` に変更が必要
- **選手背番号のソート**: DBの `number` カラムは `text` 型のため、フェッチ後にJS側で数値ソートする
- **DBトリガー**: チーム作成時 → `handle_new_team()` が作成者を `team_members` に `admin` で自動追加
- **RLS**: `team_members_insert` ポリシーは `with check (true)` のため、招待コード検証はアプリ側で行う
- **Googleログインのリダイレクト**: `window.location.origin` を使用（クライアントサイドのみ）
- **引退処理**: 削除ではなく `is_active = false` に変更して成績データを保持

## 完了要件チェックリスト

- [x] Supabaseマイグレーション適用（全テーブル・VIEW・RLS・トリガー）
- [x] TypeScript型定義生成（`lib/supabase/types.ts`）
- [x] Supabaseクライアント作成（client.ts・server.ts）
- [x] shadcn/uiコンポーネントインストール
- [x] `proxy.ts` で未認証ユーザーを `/login` にリダイレクト
- [x] `/login` 画面（Googleログイン・メール/パスワード）
- [x] `/register` 画面（表示名・メール・パスワード）
- [x] `(main)/layout.tsx`（ヘッダー・ログアウト）
- [x] トップ画面（チーム一覧・チーム作成/参加ボタン・チームなし時メッセージ）
- [x] チーム作成 `/team/new`
- [x] チーム管理 `/team/[id]`（admin のみ名前編集）
- [x] 選手管理 `/team/[id]/players`（一覧・追加・編集・引退・引退表示トグル）
- [x] 選手背番号の数値ソート対応（フェッチ後JS側でソート）
- [x] 招待・メンバー管理 `/team/[id]/invite`（招待コード表示/コピー/再発行・メンバー昇格/削除）
- [x] ビルド成功確認（`pnpm build`）
