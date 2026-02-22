# 盗塁・盗塁死の記録（Step 9）

## 概要

打席間に盗塁・盗塁死を記録できるようにする。`runner_events` テーブルは `stolen_base` / `caught_stealing` の event_type を既にサポートしており、成績ビュー（`v_batter_game_stats`, `v_batter_career_stats`）も `stolen_bases` / `caught_stealing` を集計済み。記録する UI と Server Action、状態復元ロジックを追加すれば成績画面に自動反映される。

## 作業内容

### 新規作成ファイル
なし（入力ページ内にダイアログを直接実装し、action も既存ファイルに追加）

### 変更ファイル
- `app/(main)/games/actions.ts` — `recordStealAction` を追加
- `app/(main)/games/[id]/input/page.tsx` — 盗塁ボタン + StealDialog を追加
- `hooks/useGameState.ts` — `stolen_base` / `caught_stealing` イベントを状態復元に反映（アウト数・走者位置・得点）
- `app/(main)/games/actions.test.ts` — `recordStealAction` のテスト追加

## 実装メモ

### recordStealAction の設計
- `runner_events.at_bat_id` は NOT NULL → 直前の打席を参照する必要がある
- 直前の打席がない場合（1回表の先頭打者前など）は盗塁記録不可（UI でボタンを非表示にする）
- Server Action で `at_bats` の最新 ID を取得してから `runner_events` に INSERT
- 盗塁死の場合は `caught_stealing` を INSERT（アウトカウントの加算は `useGameState` 側で処理）

### useGameState の変更
- `getOutsForResult` は `event_type === "out"` のみカウントしている → `caught_stealing` もアウトとしてカウントする必要がある
- `stolen_base` の得点ケース（ホームスチール）は `scored` イベントを別途記録しない → Action 側で3塁走者の盗塁成功時に `scored` イベントも追加するか、or 状態復元で `stolen_base` を検知して走者を進塁させるか
  - **判断**: ホームスチール成功時は `stolen_base` + `scored` の2レコードを INSERT する（ビューの得点集計は `scored` を見るため）
- 走者位置の復元: 盗塁・盗塁死のイベントは at_bat に紐づくが、打席結果とは別のタイミング → `computeRunnersAfterAtBat` に影響
  - **判断**: 盗塁イベントは打席の runner_events に混在するが、次の打席の `base_runners` スナップショットで正確に復元される。最後の打席のみ推論が必要だが、盗塁後は必ず `reload()` するので次の打席のスナップショットが存在する前に状態が更新される。

### UI の配置
- 「投手交代」「試合終了」ボタンの行に「盗塁」ボタンを追加
- 走者がいない場合は disabled
- 直前の打席がない場合も disabled
- ダイアログ: 走者選択（Select）+ 結果選択（成功/失敗ボタン）+ 確定

## 完了要件チェックリスト

- [x] `recordStealAction` を実装する（`runner_events` に `stolen_base` or `caught_stealing` を INSERT、ホームスチール成功時は `scored` も INSERT）
- [x] 入力ページに盗塁ボタン + ダイアログを追加する（走者がいる場合のみ有効）
- [x] 盗塁成功後 `gameState.reload()` で走者位置が正しく更新される
- [x] 盗塁死後 `gameState.reload()` でアウトカウントが正しく増える
- [x] `useGameState` で `caught_stealing` をアウトとしてカウントする
- [x] `recordStealAction` のユニットテストを追加する
- [x] `pnpm lint && pnpm build && pnpm test` がパスする
