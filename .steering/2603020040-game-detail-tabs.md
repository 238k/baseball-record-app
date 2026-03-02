# 試合詳細画面のタブ切り替え化

関連 issue: #4

## 概要

試合詳細画面（`GameDetailClient`）の表示項目が多く、スクロールが長くなるため、コンテンツをタブで切り替えられるようにする。

ヘッダー・試合情報・スコア・入力ボタンは常時表示し、その下のコンテンツ（イニングスコア、試合状況、打席記録、オーダー、成績）をタブで整理する。

## 現状の構造

`GameDetailClient.tsx` の表示順:
1. ヘッダー（戻るリンク + LIVE バッジ + 更新ボタン）
2. 試合タイトル・メタ情報
3. ScoreBoard
4. InningScoreTable（Card）
5. 現在の状況（フィールド表示 + アウトカウント + 打者/投手 + ピッチカウント）（Card）
6. RecentAtBatLog（Card）
7. 記録入力ボタン（finished 以外）
8. GameStatsTabs（オーダー / 打者成績 / 投手成績）（in_progress/finished のみ）

## 実装方針

### 常時表示（タブの外）
- ヘッダー（戻るリンク + LIVE バッジ + 更新ボタン）
- 試合タイトル・メタ情報
- ScoreBoard
- 記録入力ボタン（finished 以外）

### タブ構成
| タブ名 | 内容 | 表示条件 |
|--------|------|----------|
| 速報 | InningScoreTable + 現在の状況 + RecentAtBatLog | 常時（デフォルト） |
| オーダー | LineupTable（自チーム + 相手チーム） | 常時 |
| 打者成績 | BatterStatsTable | in_progress / finished |
| 投手成績 | PitcherStatsTable | in_progress / finished |

### 変更ファイル

- `components/game/GameDetailClient.tsx` — タブ構造に再編成。`GameStatsTabs` の利用をやめ、直接 Tabs コンポーネントを使う
- `components/game/GameDetailClient.test.tsx` — タブ切り替えのテスト追加・既存テスト修正

### 削除候補

- `components/stats/GameStatsTabs.tsx` — 役割が `GameDetailClient` に統合されるため不要になる。ただし他で使われていないか確認する。

## 実装メモ

- shadcn/ui の `Tabs` コンポーネントは既にインストール済み（`components/ui/tabs.tsx`）
- `GameStatsTabs` は試合詳細画面専用なので削除可能（`find_referencing_symbols` で確認）
- タブの切り替えでリアルタイム更新が止まらないよう注意（Tabs はクライアントコンポーネントで条件付きレンダリングのため問題なし）
- タブレット向け UI 規約: `TabsTrigger` のタッチターゲットサイズを確保

## 完了要件チェックリスト

- [x] GameDetailClient をタブ構造に再編成する（速報 / オーダー / 打者成績 / 投手成績）
- [x] GameStatsTabs を GameDetailClient に統合し、不要なら削除する
- [x] 打者成績・投手成績タブは in_progress / finished のときのみ表示する
- [x] 既存テスト（GameDetailClient.test.tsx）をタブ構造に合わせて修正する
- [x] タブ切り替えのテストを追加する
- [x] pnpm test が全件パスする
