# Claude Code 作業依頼: `team_members_insert (true)` のセキュア化

## 背景

現状の RLS で、以下のポリシーが存在します。

- `supabase/migrations/2602201340_initial_schama.sql`
  - `create policy "team_members_insert" on team_members for insert with check (true);`

この設定だと、認証済みユーザーが `team_members` へ任意の `INSERT` を実行でき、`team_id`・`profile_id`・`role` を自由に指定可能です。  
結果として、招待コードを経由しない参加や、権限昇格（`role='admin'`）の余地があり、認可上のリスクが高い状態です。

## 目的

- `team_members` への直接 `INSERT` を原則禁止する
- 招待コード経由の参加のみを許可する
- 既存の「チーム作成」「招待コードで参加」機能は維持する

## 実装方針（必須）

1. 新しい migration を追加する（既存 migration の書き換えはしない）
2. `team_members_insert` ポリシーを削除し、クライアント/通常ユーザーからの直接 `INSERT` を不可にする
3. 招待コード参加専用の RPC を `security definer` で作る
4. `app/(main)/team/actions.ts` の `joinTeamAction` を `from('team_members').insert(...)` から RPC 呼び出しに置き換える
5. エラーハンドリングは現在の UX（「招待コードが見つかりません」「すでにメンバーです」等）を維持する

## 具体要件

### 1) SQL: 新規 migration

ファイル例:

- `supabase/migrations/<timestamp>_secure_team_members_insert.sql`

実施内容:

- `drop policy if exists "team_members_insert" on team_members;`
- 招待参加用関数（例: `join_team_by_invite_code(p_invite_code text)`）を作成
  - `security definer`
  - `set search_path = public`
  - `auth.uid()` が `null` の場合はエラー
  - `invite_code` で `teams` を検索し、見つからなければ識別可能なエラーを返す
  - 既存メンバーなら重複扱いのエラーを返す
  - 新規参加時は `team_members(team_id, profile_id, role='member')` を作成
  - 戻り値に `team_id` を返す（`joinTeamAction` 側で再利用できるように）
- `grant execute on function ... to authenticated;`

注意:

- 関数内で `role='member'` を固定し、呼び出し側から任意 role を指定できないようにする
- `profile_id` は常に `auth.uid()` を使う

### 2) アプリ側変更

対象:

- `app/(main)/team/actions.ts`

`joinTeamAction` の処理を以下へ変更:

- 既存の `teams` 参照 + `team_members insert` の2段階をやめる
- RPC（例: `supabase.rpc('join_team_by_invite_code', { p_invite_code: code })`）を呼ぶ
- RPCの返却/エラーコードをもとに、既存メッセージへマッピング
  - 無効コード
  - 既存メンバー
  - その他想定外エラー
- `revalidatePath("/")` と `revalidatePath(`/team/${teamId}`)` は維持

## 受け入れ条件

1. 認証済みユーザーが API から直接 `team_members insert` しても拒否される
2. 招待コード経由（RPC）ではチーム参加できる
3. 同一ユーザーが同一チームへ再参加しようとすると適切に失敗する
4. チーム作成時の owner 追加（`on_team_created` トリガー）は引き続き動作する
5. 既存の `teams_select` 修正（`2602210325_fix_teams_select_returning.sql`）と矛盾しない

## 動作確認（最低限）

1. `pnpm lint`
2. `pnpm test`
3. 手動確認
   - 新規ユーザーAでチーム作成
   - ユーザーBが正しい招待コードで参加できる
   - ユーザーBが同じコードで再参加すると重複エラーになる
   - （可能なら）SQLエディタ等で B が `team_members` へ直接 `insert` を試し、拒否されることを確認

## 補足（任意）

`MemberList` では `team_members` の `update(role)` を実行しています。  
現状スキーマでは `team_members` の `update` ポリシーが未定義のため、別タスクで `admin` のみ昇格可能な `FOR UPDATE` ポリシー追加を検討してください。

