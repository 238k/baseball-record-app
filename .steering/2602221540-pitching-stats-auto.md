# 投手成績の自動集計（Step 8）

## 概要

`recordAtBatAction` で打席を記録した際、対戦投手の `pitching_records` の統計カラム（`outs_recorded`, `hits`, `runs`, `earned_runs`, `walks`, `strikeouts`）を自動更新する。
現状これらのカラムは常に 0 のため、投手成績ビュー（`v_pitcher_game_stats`, `v_pitcher_career_stats`）が全て 0 を返す致命的バグがある。

## 作業内容

### 新規作成ファイル
- `app/(main)/games/pitching-stats.ts` — `getPitchingStatsDelta` ヘルパー関数（`"use server"` ファイルからは同期関数を export できないため分離）

### 変更ファイル
- `app/(main)/games/actions.ts` — `recordAtBatAction` に投手成績更新ロジック追加（`pitching-stats.ts` を import）
- `app/(main)/games/actions.test.ts` — `getPitchingStatsDelta` のテスト追加（19ケース）

## 実装メモ

### 対戦投手の特定
- `inningHalf === "top"` → ホームが守備（ホーム投手）
- `inningHalf === "bottom"` → ビジターが守備（ビジター投手）
- `pitching_records` で `inning_to IS NULL` かつ fielding side の lineup に紐づくレコードが現在の投手

### 統計の計算方法
- **アウト数**: `runnerDestinations` の `event === "out"` の件数（打者のアウト + 走者のアウトを全て含む）
- **得点**: `runnerDestinations` の `event === "scored"` の件数
- **安打**: result が `1B`, `2B`, `3B`, `HR` → +1
- **四球**: result が `BB`, `IBB` → +1
- **三振**: result が `K`, `KK` → +1
- **自責点**: 得点と同値（エラーによる非自責点の区別は現スキーマでは不可能）

### 更新方法
- 現在の `pitching_records` の値を取得してから加算して update する
- 排他制御（`game_input_sessions`）により同時記録は発生しないため、read-then-update で安全

## 完了要件チェックリスト

- [x] `getPitchingStatsDelta` ヘルパー関数を実装し export する
- [x] `recordAtBatAction` で対戦投手の `pitching_records` を自動更新する
- [x] `getPitchingStatsDelta` のユニットテストを追加する（全 result コード + DP の走者アウト）
- [x] `pnpm lint && pnpm build && pnpm test` がパスする
