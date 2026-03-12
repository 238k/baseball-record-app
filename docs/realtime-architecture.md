# リアルタイム購読の設計方針

## 基本原則

**1つの `gameId` に対して1つのリアルタイムチャネルを使用する。**

## 現状の構造

```
useRealtimeGame（オーケストレーター）
  ├── useGameState（データ取得 + 状態再構築）
  │     └── reload() を公開（リアルタイムイベント時に呼ばれる）
  └── useGameSession（セッション管理 + ハートビート）
        └── 独自チャネル `game-session-${gameId}`

useRealtimeGame 自身のチャネル: `spectate-${gameId}`
  ├── at_bats テーブル変更 → gameState.reload() + fetchSupplementary()
  ├── games テーブル変更 → gameState.reload()
  └── game_input_sessions 変更 → fetchSupplementary()
```

### 現状の問題点

1. **チャネルの重複**: `spectate-${gameId}` と `game-session-${gameId}` が同じゲームに対して並行稼働
2. **reload の競合**: 複数の購読が同時に `reload()` をトリガーし、同じデータを重複取得
3. **クリーンアップの複雑さ**: 各フックが独立してチャネルを管理し、unmount 順序で問題が起きうる

## 目指すべき構造

```
useGameChannel（単一チャネルオーケストレーター）
  └── チャネル: `game-${gameId}`
        ├── at_bats 変更 → onAtBatChange コールバック
        ├── games 変更 → onGameChange コールバック
        ├── game_input_sessions 変更 → onSessionChange コールバック
        ├── game_input_requests 変更 → onRequestChange コールバック
        ├── base_runners 変更 → onRunnerChange コールバック
        └── runner_events 変更 → onRunnerEventChange コールバック

useGameState（データ取得 + 状態再構築）— チャネルを持たない
useGameSession（セッション管理 + ハートビート）— チャネルを持たない
```

## チャネル命名規則

```
game-${gameId}          # ゲーム関連の全イベント（統合チャネル）
```

## 購読ライフサイクル

### マウント時

```typescript
function useGameChannel(gameId: string, callbacks: GameChannelCallbacks) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`game-${gameId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "at_bats",
        filter: `game_id=eq.${gameId}`
      }, callbacks.onAtBatChange)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "games",
        filter: `id=eq.${gameId}`
      }, callbacks.onGameChange)
      // ... 他のテーブルも同様
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]); // gameId 変更時にチャネルを再作成
}
```

### アンマウント時

- `supabase.removeChannel(channel)` でクリーンアップ
- コールバック参照は最新値を使う（stale closure 防止に ref を使用）

### 再接続

Supabase のリアルタイムクライアントが自動再接続を処理する。追加のロジックは不要。

## ハートビート

セッションホルダーは一定間隔で `last_active_at` を更新する。

```typescript
// useGameSession 内
useEffect(() => {
  if (!isHolder) return;

  const interval = setInterval(async () => {
    await supabase
      .from("game_input_sessions")
      .update({ last_active_at: new Date().toISOString() })
      .eq("game_id", gameId);
  }, 30_000); // 30秒間隔

  return () => clearInterval(interval);
}, [isHolder, gameId]);
```

- ハートビートはリアルタイムチャネルとは独立して管理
- `beforeunload` イベントでセッション解放を試みる（`fetch` with `keepalive`）

## Supabase Realtime の注意事項

### Replication 設定

以下のテーブルで Realtime が有効化されている必要がある（Supabase Dashboard > Database > Replication）:

- `game_input_sessions`
- `game_input_requests`
- `at_bats`
- `base_runners`
- `runner_events`
- `games`

### パフォーマンス

- フィルター付き購読（`filter: game_id=eq.${gameId}`）を使い、不要なイベントを受信しない
- `event: "*"` で INSERT / UPDATE / DELETE すべてを監視（個別指定より簡潔）
- イベントハンドラ内で重い処理をしない（データ再取得のトリガーのみ）

### デバッグ

```typescript
// 開発時のみ: チャネルのステータス監視
channel.on("system", {}, (payload) => {
  console.log("Channel status:", payload);
});
```
