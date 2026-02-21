# Step 1 実装検証レポート

**実施日**: 2026-02-21
**対象仕様書**: `docs/step1_auth_team_players.md`

---

## 検証結果サマリー

仕様書の完了条件 9 項目をすべて確認し、**2 件のバグを発見・修正**した。

| # | 完了条件 | 結果 |
|---|---------|------|
| 1 | メールアドレスで新規登録・ログインができる | OK |
| 2 | Googleアカウントでログインができる | OK |
| 3 | ログアウトができる | OK |
| 4 | 未認証状態でトップにアクセスするとログイン画面にリダイレクトされる | OK |
| 5 | チームを作成できる | OK |
| 6 | 作成したチームがトップ画面に表示される | OK |
| 7 | 招待コードを別アカウントで入力してチームに参加できる | OK |
| 8 | 選手を登録・編集・引退（削除）できる | OK |
| 9 | adminがメンバーを削除できる | OK |

---

## 検証方法

### コードレベル検証

- 仕様書のディレクトリ構成と実際のファイルを照合し、全ファイルの存在を確認
- 各ページ・コンポーネントのコードを読み、仕様の要件（UI サイズ、ローディング状態、エラー表示等）を確認
- Supabase の RLS ポリシー・RPC 関数・トリガーを SQL で直接検証
- `pnpm test`（Vitest 44 テスト全通過）および `pnpm build` で型チェック・ビルドを確認

### ブラウザ検証（Chrome DevTools MCP）

以下のページを実際に表示して動作確認した。

| ページ | 確認内容 |
|--------|---------|
| `/login` | Google ボタン、メール+パスワードフォーム、新規登録リンク |
| `/` (トップ) | チーム一覧、「チームに参加」「チームを作成」ボタン、ユーザー名、ログアウト |
| `/team/[id]` | チーム名、管理者バッジ、招待コード、編集ボタン、選手管理/招待リンク |
| `/team/[id]/players` | 選手追加ボタン、引退選手表示トグル、空状態メッセージ |
| `/team/[id]/invite` | 招待コード表示、コピー/再発行ボタン、メンバー一覧（修正後） |
| `/register` | ログイン済みの場合 `/` にリダイレクト（proxy.ts の動作確認） |

---

## 発見したバグと修正

### 1. team_members の SELECT RLS ポリシーの不備

**症状**: 招待・メンバー管理ページでチームメンバーが自分しか表示されない。

**原因**: `team_members_select` ポリシーが `profile_id = auth.uid()` になっており、自分自身のメンバーシップレコードしか読み取れなかった。

**修正内容**: 同じチームのメンバー全員を閲覧可能にするポリシーに変更。

```sql
-- 修正前
CREATE POLICY team_members_select ON team_members
  FOR SELECT USING (profile_id = auth.uid());

-- 修正後
CREATE POLICY team_members_select ON team_members
  FOR SELECT USING (team_id IN (SELECT get_my_team_ids()));
```

`get_my_team_ids()` は `SECURITY DEFINER` 関数のため、RLS の再帰問題を回避できる。

**修正ファイル**: `supabase/migrations/2602211900_fix_team_members_select_policy.sql`

### 2. Supabase 型定義の未更新によるビルドエラー

**症状**: `pnpm build` で型エラー — `"join_team_by_invite_code"` が `never` 型に代入できない。

**原因**: RPC 関数（`join_team_by_invite_code`, `promote_team_member`）追加後に `lib/supabase/types.ts` が再生成されていなかった。

**修正内容**: Supabase MCP で型定義を再生成し、`Functions` セクションに RPC 関数の型が含まれるようにした。

**修正ファイル**: `lib/supabase/types.ts`（再生成）

---

## その他の改善

### ドキュメントの `middleware.ts` → `proxy.ts` 置換

Next.js 16 では `middleware.ts` が `proxy.ts` に変更されているが、ドキュメント内に旧名称が残っていたため修正。

| ファイル | 修正内容 |
|---------|---------|
| `CLAUDE.md` | Route Groups 説明の `middleware.ts` → `proxy.ts` |
| `docs/step1_auth_team_players.md` | ディレクトリ構成・セクション見出し |
| `.steering/2602201340-auth-team-players.md` | 実装メモの説明文を整理 |

### `.gitignore` への一時ディレクトリ追加

以下の一時ディレクトリが git 管理対象から除外されていなかったため追加。

- `.claude/worktrees/` — Claude Code の作業用ワークツリー
- `supabase/.temp/` — Supabase CLI の一時ファイル
