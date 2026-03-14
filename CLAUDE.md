# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Implementation Workflow

機能実装には `/implement` スキルを使用してください。

- コードベースを調査した上で、`.steering/YYMMDDhhmm-機能名.md` に作業内容・完了要件チェックリストを作成します
- ドキュメントのセルフレビュー後、チェックリストをすべて完了するまで自律的に実装を続けます

## Unit Testing Requirements

**新しいロジック・コンポーネントを実装するときは必ずユニットテストを書いてください。**

### テスト対象の優先度

1. **必須**: バリデーションや条件分岐を含む関数・Server Actions（`actions.test.ts`）
2. **必須**: 表示条件・権限制御を持つコンポーネント（React Testing Library）
3. **推奨**: ユーティリティ関数・純粋関数

### テスト技術スタック

- **テストフレームワーク**: Vitest + React Testing Library
- **セットアップ**: `vitest.setup.ts`（jest-dom + テスト後の cleanup）
- **テスト実行**: `pnpm test` (一度実行) / `pnpm test:watch` (ウォッチ)

### モックのルール

| モック対象 | 方法 |
|---|---|
| `next/navigation` (useRouter等) | `vi.mock('next/navigation', ...)` |
| `next/link` | `vi.mock('next/link', ...)` でシンプルな `<a>` に置換 |
| Server Actions (`@/app/.../actions`) | `vi.mock(...)` で関数をモック |
| Supabase server client (`@/lib/supabase/server`) | `vi.mock(...)` でチェーン可能なモックを返す |
| Supabase browser client (`@/lib/supabase/client`) | `vi.mock(...)` |

### テストファイルの配置

テストファイルはテスト対象と同じディレクトリに配置します:
- `lib/utils.ts` → `lib/utils.test.ts`
- `app/(main)/team/actions.ts` → `app/(main)/team/actions.test.ts`
- `components/team/TeamCard.tsx` → `components/team/TeamCard.test.tsx`

## Git Operations

git操作（pull、push、PR作成、issue操作など）はすべて `gh` コマンド（GitHub CLI）を使用してください。

```bash
gh repo sync           # リモートの最新状態に同期
gh pr create           # プルリクエスト作成
gh pr list             # PR一覧
gh issue list          # issue一覧
```

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # ESLint
pnpm test         # Run tests once (Vitest)
pnpm test:watch   # Watch mode
```

To run a single test file:
```bash
pnpm vitest run path/to/file.test.ts
```

To add shadcn/ui components:
```bash
npx shadcn@latest add <component-name>
```

## Local Development (Supabase)

Docker Desktop が必要です。ローカル Supabase を使った開発手順:

```bash
pnpm supabase:start    # Supabase コンテナ起動（初回はイメージDL）
pnpm supabase:reset    # マイグレーション再適用 + seed.sql でデータ投入
pnpm supabase:stop     # コンテナ停止
pnpm supabase:status   # 起動中サービスのURL・キー表示
pnpm supabase:gen-types  # ローカルDBから型定義を再生成
```

初回セットアップ:
1. `cp .env.local.example .env.local`
2. `pnpm supabase:start`（出力される anon key が example と同一であることを確認）
3. `pnpm dev`
4. `http://localhost:3000/login` → `admin@example.com` / `password123`

テストデータ（`supabase/seed.sql`）:
- ユーザー: `admin@example.com`（管理者）、`member@example.com`（メンバー）
- チーム: テストタイガース（招待コード `TEST1234`）
- 選手: 11名（9ポジション + 控え2名）
- 試合: 2件（通常ルール + DH制）

Supabase Studio: `http://127.0.0.1:54323`（ローカルDB管理画面）

## Architecture

This is a Japanese baseball game recording app (野球試合記録アプリ) built for tablet (iPad portrait) use. It uses Next.js 16 App Router with Supabase for auth and the database.

### Route Groups

- `app/(auth)/` — Unauthenticated routes: `/login`, `/register`
- `app/(main)/` — Authenticated routes behind `proxy.ts` redirect. Includes: `/` (game list), `/games/new`, `/games/[id]`, `/games/[id]/lineup`, `/games/[id]/input`, `/team/new`, `/team/[id]`, `/team/[id]/players`, `/team/[id]/invite`, `/team/[id]/stats`

### Supabase Client Pattern

Two separate clients must be used:
- `lib/supabase/client.ts` — Browser (Client Components)
- `lib/supabase/server.ts` — Server (Server Components, Route Handlers, Server Actions)
- `lib/supabase/types.ts` — Auto-generated from `npx supabase gen types typescript`

Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### State Management

Game recording state uses custom React hooks (`hooks/useGameState.ts`). Zustand is available for global state. The `useGameState` hook reconstructs game state (current inning, outs, base runners, score) by fetching the latest `at_bats` and `base_runners` from Supabase and must be restorable after page reload.

### Database Schema Overview

Core tables: `profiles` → `teams` → `team_members`, `players`, `games` (`use_dh` boolean for DH rule)

Game recording: `lineups` → `at_bats` → `pitches`, `base_runners`, `runner_events`, `pitching_records`

Exclusive input control: `game_input_sessions` (one per game), `game_input_requests`

Statistical views: `v_batter_game_stats`, `v_batter_career_stats`, `v_pitcher_game_stats`, `v_pitcher_career_stats`, `v_scoreboard` — always query these views rather than computing stats in TypeScript.

Key DB behaviors driven by triggers:
- New user → auto-creates `profiles` row
- New team → auto-adds owner as `admin` in `team_members`

Realtime subscriptions (must be enabled in Supabase dashboard > Database > Replication): `game_input_sessions`, `game_input_requests`, `at_bats`, `base_runners`, `runner_events`, `games`

### At-Bat Result Codes

`1B`, `2B`, `3B`, `HR`, `BB`, `IBB`, `HBP`, `K` (swinging), `KK` (looking), `GO`, `FO`, `LO`, `DP`, `SF`, `SH`, `FC`, `E`

### UI Conventions

shadcn/ui (new-york style, Gray base) is used throughout. Standard sizing for tablet touch targets:
- `Button`: `size="lg"`, key actions add `className="min-h-16 text-lg"`
- `Input`: `className="text-lg h-14"`
- `Dialog` for modals, `AlertDialog` for confirmations
- Loading states: `disabled` + spinner on Button

Defensive position labels (Japanese): 投・捕・一・二・三・遊・左・中・右・DH

### Path Aliases

```
@/components  →  components/
@/lib         →  lib/
@/hooks       →  hooks/
@/components/ui  →  components/ui/  (shadcn auto-generated)
```

## Code Quality Rules

詳細は `docs/` 配下の各ドキュメントを参照。

### コンポーネント設計 → [docs/component-guidelines.md](docs/component-guidelines.md)

- 1ファイル300行以下。超える場合は分割を検討
- ビジネスロジック（計算・判定・変換）はコンポーネント外の `lib/` に配置
- `useState` が3個を超えたら `useReducer` または Zustand を使用
- 同じ概念を複数の state で表現しない（単一の構造に統合）

### Server Action → [docs/server-action-patterns.md](docs/server-action-patterns.md)

- 常に `{ data, error }` 形式で返す。エラーを `console.error` だけで握りつぶさない
- 認証チェック（`getUser()`）は全アクションで必須
- 複数テーブルへの書き込みはトランザクション（Supabase RPC）で実行
- ステータスチェック等の共通処理はヘルパー関数に集約

### バリデーション → [docs/validation-strategy.md](docs/validation-strategy.md)

- Zod スキーマをクライアント・サーバーで共有
- ドメイン値（結果コード、ポジション、塁）は `z.enum()` でリテラル型定義

### 型安全性

- `as` による型アサーション禁止。型ガードまたは Supabase 生成型を使用
- Supabase クエリには `.returns<T>()` を活用
- 生成型 `Database["public"]["Tables"]["xxx"]["Row"]` を積極的に使用

### データベース → [docs/database-conventions.md](docs/database-conventions.md)

- FK列には必ずインデックスを作成
- JSONB列には CHECK 制約を付与
- 主要テーブルに `updated_at` を追加（自動更新トリガー付き）
- マイグレーション命名: `YYMMDDHHMM_snake_case_description.sql`

### リアルタイム → [docs/realtime-architecture.md](docs/realtime-architecture.md)

- 1つの `gameId` に対して1つのリアルタイムチャネル
- フック内にリアルタイム購読を持たせず、チャネルオーケストレーターから分離
