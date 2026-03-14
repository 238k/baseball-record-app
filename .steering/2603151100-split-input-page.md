# input/page.tsx の分割リファクタリング

関連 issue: #13

## 概要

`app/(main)/games/[id]/input/page.tsx`（2119行）を300行以下に分割する。
ビジネスロジックの分離、状態管理のリファクタ、コンポーネント分割を行う。

## 方針

### 1. ビジネスロジックの分離

page.tsx 先頭に定義されている純粋関数を `lib/game/` に移動:

- `lib/game/runner-logic.ts` — `getDefaultDestinations`, `getDefaultBatterDest`, `isRunnerForced`, `getDestOptionsForBase`
- `lib/game/rbi-logic.ts` — `computeRbi`
- `lib/game/at-bat-logic.ts` — `countOutsFromResult`

### 2. コンポーネント分割

各ダイアログを独立コンポーネントに:

- `components/game/input/RunnerDestinationDialog.tsx` — 走者進塁先ダイアログ (l.1530-1600)
- `components/game/input/InningChangeDialog.tsx` — 攻守交代ダイアログ (l.1602-1619)
- `components/game/input/PitcherChangeDialog.tsx` — 投手交代ダイアログ (l.1621-1661)
- `components/game/input/FinishGameDialog.tsx` — 試合終了ダイアログ (l.1663-1680)
- `components/game/input/StealDialog.tsx` — 盗塁ダイアログ (l.1682-1727)
- `components/game/input/SubstitutionDialog.tsx` — 選手交代ダイアログ (l.1729-1873)
- `components/game/input/UndoConfirmDialog.tsx` — 打席取消ダイアログ (l.1875-1892)
- `components/game/input/AdvanceDialog.tsx` — WP/PB/BK ダイアログ (l.1894-1956)
- `components/game/input/PositionChangeDialog.tsx` — 守備変更ダイアログ (l.1958-2102)
- `components/game/input/ScheduledView.tsx` — スケジュール済み画面 (l.1102-1158)
- `components/game/input/GameInputMain.tsx` — メイン入力UI (BSO/ピッチ/ユーティリティ行)

### 3. カスタムフックの抽出

- `hooks/useGameInput.ts` — 打席処理・保存ロジック (autoSaveAtBat, processResult, handleSaveAtBat)
- 各ダイアログの state は各コンポーネント内で管理（props で open/onClose/onConfirm を受ける）

### 4. 状態管理の整理

page.tsx に残る state を最小化:
- gameState, session（既存フック）
- actionError（共通エラー表示）
- pitchLog（ピッチカウント）
- 各ダイアログの open/close フラグ → 各コンポーネント内に移動可能なものは移動

## 完了条件チェックリスト

- [x] `lib/game/runner-logic.ts` を作成し、テストを追加 (153行 + 133行テスト, 25テスト)
- [x] `lib/game/rbi-logic.ts` を作成し、テストを追加 (19行 + 37行テスト, 5テスト)
- [x] `lib/game/at-bat-logic.ts` を作成し、テストを追加 (17行 + 27行テスト, 4テスト)
- [x] 各ダイアログコンポーネントを分割（9つ）
- [x] `ScheduledView` コンポーネントを分割 (81行)
- [x] `hooks/useGameInput.ts` を抽出 (291行)
- [x] `hooks/useGameActions.ts` を抽出 (238行)
- [x] `input/page.tsx` が300行以下 → **260行**
- [x] 全コンポーネントが300行以下
- [x] `pnpm build` が通る
- [x] `pnpm test` が通る (319テスト全パス)
- [x] `pnpm lint` が通る (既存の問題のみ、新規ファイルにエラーなし)
