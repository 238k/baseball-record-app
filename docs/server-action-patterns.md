# Server Action パターン

## 戻り値の標準形式

**全 Server Action は `{ data, error }` の判別可能なユニオン型で返す。**

```tsx
type ActionResult<T = void> =
  | { data: T; error?: never }
  | { data?: never; error: string };
```

```tsx
// OK
export async function createGameAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = parseOrError(createGameSchema, input);
  if (parsed.error) return { error: parsed.error };

  // ... 処理 ...

  return { data: { id: game.id } };
}

// NG: console.error で握りつぶし
if (deleteError) {
  console.error("error:", deleteError);
  // ← ユーザーにエラーが伝わらない
}
```

## 認証・認可チェック

### 認証（全アクションで必須）

```tsx
const { data: { user } } = await supabase.auth.getUser();
if (!user) return { error: "ログインが必要です" };
```

### 認可（リソースアクセス時に必須）

```tsx
// ゲーム操作権限
async function enforceGameAccess(supabase: SupabaseClient, gameId: string, userId: string) {
  const { data: game } = await supabase
    .from("games")
    .select("team_id, created_by")
    .eq("id", gameId)
    .single();

  if (!game) return { error: "試合が見つかりません" };

  // チームメンバーか、作成者本人か
  if (game.team_id) {
    const { data: member } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", game.team_id)
      .eq("profile_id", userId)
      .single();
    if (!member) return { error: "この試合にアクセスする権限がありません" };
  } else if (game.created_by !== userId) {
    return { error: "この試合にアクセスする権限がありません" };
  }

  return { data: game };
}
```

### ステータスチェック（共通ヘルパーに集約）

```tsx
// 現状: 6箇所以上にコピペされている
// 目標: 共通ヘルパーに集約
async function enforceGameStatus(
  supabase: SupabaseClient,
  gameId: string,
  expectedStatus: "scheduled" | "in_progress" | "finished"
) {
  const { data: game } = await supabase
    .from("games")
    .select("status")
    .eq("id", gameId)
    .single();

  if (!game) return { error: "試合が見つかりません" };
  if (game.status !== expectedStatus) {
    const messages: Record<string, string> = {
      scheduled: "試合前の試合でのみ実行できます",
      in_progress: "試合中の試合でのみ実行できます",
      finished: "終了した試合でのみ実行できます",
    };
    return { error: messages[expectedStatus] };
  }

  return { data: game };
}
```

## バリデーション

**Zod スキーマで入力を検証し、`parseOrError` ヘルパーを使う。**

```tsx
import { parseOrError } from "./validation";

export async function createGameAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = parseOrError(createGameSchema, input);
  if (parsed.error) return { error: parsed.error };

  const { data } = parsed;
  // data は型安全
}
```

詳細は [validation-strategy.md](./validation-strategy.md) を参照。

## トランザクション（複数テーブル更新）

**複数テーブルへの書き込みは PostgreSQL 関数（RPC）でトランザクション化する。**

```tsx
// 現状の問題: 5つの INSERT がトランザクションなし
// at_bats INSERT → base_runners INSERT → runner_events INSERT → pitches INSERT → pitching_records UPDATE
// 途中で失敗するとデータ不整合

// 目標: RPC でトランザクション化
const { data, error } = await supabase.rpc("record_at_bat", {
  p_game_id: gameId,
  p_lineup_id: lineupId,
  p_result: result,
  p_runner_destinations: runnerDestinations,
  p_pitches: pitches,
});
```

PostgreSQL 関数側:
```sql
CREATE OR REPLACE FUNCTION record_at_bat(
  p_game_id uuid,
  p_lineup_id uuid,
  p_result text,
  p_runner_destinations jsonb,
  p_pitches jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 全操作が1トランザクション内で実行される
  INSERT INTO at_bats (...) VALUES (...);
  INSERT INTO base_runners (...) VALUES (...);
  INSERT INTO runner_events (...) VALUES (...);
  INSERT INTO pitches (...) VALUES (...);
  UPDATE pitching_records SET ...;

  RETURN jsonb_build_object('at_bat_id', v_at_bat_id);
EXCEPTION WHEN OTHERS THEN
  RAISE;  -- トランザクション全体がロールバック
END;
$$;
```

## ファイル分割

**actions.ts が300行を超えたら機能ごとにファイルを分割する。**

```
app/(main)/games/
  actions/
    create-game.ts        # 試合作成
    save-lineup.ts        # ラインナップ保存
    record-at-bat.ts      # 打席記録
    undo-at-bat.ts        # 打席取り消し
    game-status.ts        # 試合ステータス変更
    helpers.ts            # enforceGameAccess, enforceGameStatus
    index.ts              # re-export
```

## エラーメッセージ

- ユーザー向けメッセージは日本語
- 技術的な詳細は `console.error` に記録しつつ、ユーザーには一般的なメッセージを返す
- 同じ種類のエラーには同じメッセージを使う（一貫性）

```tsx
// OK
if (insertError) {
  console.error("createGame insert error:", insertError);
  return { error: "試合の作成に失敗しました" };
}

// NG: エラーを握りつぶし
if (insertError) {
  console.error("error:", insertError);
  // return がない → ユーザーに通知されない
}
```
