# handlePromote セキュリティ修正（RPC化）

## 概要

`MemberList.tsx` の `handlePromote` が `team_members` テーブルに直接 UPDATE を発行している。
`team_members` には UPDATE ポリシーが存在しないため、認証済みユーザーなら誰でも
任意のメンバーの `role` を `admin` に変更できるセキュリティ上の問題がある。

`join_team_by_invite_code` と同じパターンで SECURITY DEFINER の RPC 関数を作成し、
サーバー側で admin チェックを強制する。

## 作業内容

### 新規作成ファイル
- `supabase/migrations/2602211800_add_promote_member_rpc.sql` — RPC 関数定義

### 変更ファイル
- `app/(main)/team/actions.ts` — `promoteMemberAction` Server Action を追加
- `components/team/MemberList.tsx` — `handlePromote` を Server Action 呼び出しに変更
- `components/team/MemberList.test.tsx` — Supabase client モックを Server Action モックに更新

## 実装メモ

- RPC 関数 `promote_team_member(p_member_id uuid)` の処理:
  1. `auth.uid()` が NULL なら `not_authenticated` 例外
  2. `p_member_id` からチームIDを取得、なければ `member_not_found` 例外
  3. 呼び出し元が同チームの admin でなければ `not_authorized` 例外
  4. `role` を `admin` に UPDATE
- `handleRemove` は `team_members_delete` RLS ポリシーで admin チェック済みのため変更不要
- MemberList は Client Component だが、Next.js App Router では Server Action をインポート可能
- Server Action 内では `@/lib/supabase/server` を使用（browser client ではなく）

## 完了要件チェックリスト

- [x] `supabase/migrations/2602211800_add_promote_member_rpc.sql` を作成
- [x] `app/(main)/team/actions.ts` に `promoteMemberAction` を追加
- [x] `components/team/MemberList.tsx` の `handlePromote` を `promoteMemberAction` 呼び出しに変更
- [x] `components/team/MemberList.test.tsx` を Server Action モックに更新
- [x] `pnpm test` で全テスト通過
- [x] `pnpm lint` でエラーなし
