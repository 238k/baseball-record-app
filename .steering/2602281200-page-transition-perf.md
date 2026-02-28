# 画面遷移の高速化

## 概要
画面遷移が遅い問題を解消する。主な原因は (1) 全Linkの prefetch 無効化、(2) Layout/ページでの直列・重複クエリ、(3) loading.tsx（Suspense境界）の不在、(4) useGameState等の直列DBクエリ。

## 作業内容

### 変更ファイル

**1. prefetch={false} の削除（13ファイル）**
- `app/(main)/layout.tsx` — 4箇所の prefetch={false} 削除
- `app/(main)/games/page.tsx` — 1箇所
- `app/(main)/settings/page.tsx` — 1箇所
- `app/(main)/games/[id]/edit/page.tsx` — 1箇所
- `app/(main)/team/[id]/stats/page.tsx` — 1箇所
- `app/(main)/team/[id]/page.tsx` — 1箇所
- `app/(main)/team/[id]/players/[playerId]/page.tsx` — 1箇所
- `app/(main)/team/new/page.tsx` — 1箇所
- `components/game/GameDetailClient.tsx` — 1箇所
- `components/game/TodayGameCard.tsx` — 2箇所
- `components/game/GameCard.tsx` — 2箇所
- `components/stats/BatterStatsTable.tsx` — 2箇所
- `components/stats/PitcherStatsTable.tsx` — 2箇所

**2. Layout のクエリ並列化**
- `app/(main)/layout.tsx` — getUser() と profiles クエリを Promise.all で並列実行

**3. ページの重複 getUser() 削除**
- `app/(main)/page.tsx` — layout で認証済みなので getUser() を削除、user.id が必要なのでcreateClient経由でgetUserは残すが redirect 削除
- `app/(main)/games/page.tsx` — 同上
- `app/(main)/teams/page.tsx` — 同上
- `app/(main)/team/[id]/page.tsx` — 同上
- `app/(main)/team/[id]/stats/page.tsx` — 同上
- `app/(main)/team/[id]/players/[playerId]/page.tsx` — 同上

→ 注意: これらのページは user.id を使ってデータを取得しているため、getUser() 自体は必要。ただし `if (!user) redirect("/login")` のガード処理は layout で担保されているので削除可能。実際には Supabase の getUser() はリクエスト内でデデュプされる可能性があるため、redirect ガードの削除のみ行う。

**4. useGameState のクエリ並列化**
- `hooks/useGameState.ts` — game取得後、team/lineups クエリを並列実行。at_bats 取得後、runner_events/base_runners を並列実行

**5. loading.tsx の追加**
- `app/(main)/loading.tsx` — メイン共通ローディング
- `app/(main)/games/loading.tsx` — 試合一覧
- `app/(main)/games/[id]/loading.tsx` — 試合詳細
- `app/(main)/teams/loading.tsx` — チーム
- `app/(main)/team/[id]/loading.tsx` — チーム詳細
- `app/(main)/team/[id]/stats/loading.tsx` — 成績
- `app/(main)/team/[id]/players/[playerId]/loading.tsx` — 選手成績

**6. useRealtimeGame の fetchSupplementary 並列化**
- `hooks/useRealtimeGame.ts` — v_scoreboard, game_input_sessions, at_bats を並列実行

**7. games/new の useEffect 内クエリ並列化**
- `app/(main)/games/new/page.tsx` — getUser取得後、profiles と team_members を並列実行

## 実装メモ
- prefetch のデフォルト値は Next.js 16 では `null`（viewport に入ったときに自動プリフェッチ）。明示的に `prefetch={false}` を削除するだけでよい。
- loading.tsx は shadcn/ui の Loader2 を使いシンプルなスピナー表示。
- Supabase の `createClient()` はリクエストごとにクライアントを作成するが、Next.js の fetch デデュプは Supabase のPostgREST呼び出しでは効かないため、明示的な並列化が重要。
- Layout からの getUser() 削除は行わない（認証ガードが必要なため）。ページ側は user.id を使う必要があるので getUser() 自体は呼ぶが、redirect ガードを削除してコードを簡潔にする。

## 完了要件チェックリスト

- [x] 全13ファイルから prefetch={false} を削除
- [x] layout.tsx の getUser+profiles クエリを Promise.all で並列化
- [x] 各ページの冗長な redirect ガード削除（4ページ: page, games, teams, team/[id]）
- [x] useGameState の reload() 内クエリを可能な限り並列化
- [x] useRealtimeGame の fetchSupplementary() 内クエリを並列化
- [x] games/new の useEffect 内クエリを並列化
- [x] 主要ルートに loading.tsx を追加（7ファイル）
- [x] pnpm build が成功すること
- [x] pnpm test が成功すること
