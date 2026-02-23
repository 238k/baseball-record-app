# 選手交代（代打・代走・守備変更）（Step 10）

## 概要

代打・代走・守備位置変更を記録できるようにする。`lineups.inning_from` カラムが既に存在するが、常に 1 が入っており途中交代に使われていない。同一 `batting_order` に複数の lineup レコードを作成し、`inning_from` が最も大きいものを現在の選手として扱う。

## 作業内容

### 変更ファイル

- `hooks/useGameState.ts` — `LineupPlayer` に `inning_from` 追加、fetch クエリ更新
- `app/(main)/games/[id]/input/page.tsx` — 打者決定ロジックを最新 lineup 優先に変更、交代ボタン + ダイアログ追加
- `app/(main)/games/actions.ts` — `substitutePlayerAction`, `changePositionAction` 追加
- `app/(main)/games/actions.test.ts` — 新 Action のテスト追加

### 新規作成ファイル

なし（入力ページ内にダイアログを直接実装）

## 実装メモ

### 打者決定ロジックの変更

現在:
```typescript
const currentBatter = battingLineup.find(l => l.batting_order === order);
```

変更後: 同一 batting_order に複数エントリがある場合、`inning_from` が最大のものを使う。
`battingLineup` memo 自体を「各 batting_order の最新エントリのみ」にフィルタする。

### 代打（pinch_hitter）

- 現在の打者の batting_order に新しい lineups レコードを INSERT（`inning_from = currentInning`）
- 次の reload で `battingLineup` が最新エントリを表示
- 打席はまだ記録されていないので `runners_after` 等の更新は不要

### 代走（pinch_runner）

- 走者の batting_order に新しい lineups レコードを INSERT（`inning_from = currentInning`）
- 最新の at_bat の `runners_after` で old lineup_id → new lineup_id に差し替え
  - これにより reload 後に新しい走者が表示される
  - `runners_after` が null の場合（旧データ）は差し替え不要（fallback 推論で対応）

### 守備変更

- 既存の lineup レコードの `position` を直接 UPDATE
- 2人の守備位置を交換する場合は配列で受け取り一括更新

### 自チーム vs 相手チーム

- `game.team_id` + `game.is_home` で自チーム側を判定
- 自チーム: `players` テーブルから未出場選手を Select で選択
- 相手チーム: 選手名を Input で入力（`player_id = null`）

### DH ルール時の注意

- DH ゲームでは投手（`position = "投"`）が打順と別枠
- 代打で投手を代えた場合は DH 解除になるが、本実装では扱わない（将来対応）

## 完了要件チェックリスト

- [x] `LineupPlayer` に `inning_from` を追加し、useGameState で fetch する
- [x] 入力ページの打者決定を最新 lineup エントリ優先に変更
- [x] `substitutePlayerAction` を実装する（lineups INSERT + 代走時の runners_after 更新）
- [x] `changePositionAction` を実装する（lineups の position UPDATE）
- [x] 入力ページに「交代」ボタン + 代打/代走ダイアログを追加する
- [x] 入力ページに「守備変更」ボタン + ダイアログを追加する
- [x] 自チーム交代時に未出場選手を players テーブルから取得して表示する
- [x] 相手チーム交代時に選手名入力フィールドを表示する
- [x] `substitutePlayerAction` のユニットテストを追加する
- [x] `changePositionAction` のユニットテストを追加する
- [x] `pnpm lint && pnpm build && pnpm test` がパスする
