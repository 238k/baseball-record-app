# 投球カウント入力の追加（Step 4）

## 概要

Step 3 で実装した打席結果入力に、投球カウント（ボール・ストライク・ファウル）を追加する。
投球ごとに `pitches` テーブルにレコードを保存し、ボール4で四球・ストライク3で三振を自動誘導する。

## 作業内容

### 新規作成ファイル

- `components/game/PitchCounter.tsx` — 投球カウント表示（Badge）+ 投球ボタン3種（ボール/ストライク/ファウル）+ 取り消しボタン

### 変更ファイル

- `app/(main)/games/[id]/input/page.tsx` — PitchCounter を組み込み、投球履歴 state を管理。ボール4/ストライク3時のハイライト連携。打席確定時に pitches と pitch_count を送信。打席確定後にカウントリセット
- `app/(main)/games/actions.ts` — `RecordAtBatInput` に `pitchCount` と `pitches` を追加、at_bat INSERT 時に pitch_count を反映し、pitches を一括 INSERT
- `components/game/AtBatInput.tsx` — `highlightCode` prop を追加してハイライト表示対応

## 実装メモ

### 投球カウントの状態管理

- 投球履歴を `pitchLog: Array<"ball" | "strike" | "foul">` としてクライアント state で管理する
- 投球ボタン押下 → pitchLog に追加 → B/S/F カウントを pitchLog から算出（派生値）
- 取り消し → pitchLog の末尾を pop
- 打席確定時に pitchLog を Server Action に渡し、at_bat INSERT 後に pitches を一括 INSERT

### DB書き込みは打席確定時のみ

- 投球途中はローカル state のみ。DBには書かない
- 打席確定時に `recordAtBatAction` に `pitchCount` と `pitches` を追加で渡す
- Server Action 内で at_bat INSERT → pitches 一括 INSERT の順

### カウントルール

- ボール: 0-3 → 4になったら四球を自動設定
- ストライク: 0-2 → 3になったら三振を自動設定
- ファウル: ストライク2の時はカウント増加なし（foul として pitches に記録はする）

### ハイライト連携

- ボール4到達 → AtBatInput の「四球」ボタンをハイライト表示
- ストライク3到達 → AtBatInput の「三振(空)」ボタンをハイライト表示
- ハイライトは視覚的な誘導で、最終的な結果は手動確定

### ページリロード時の復元

useGameState で「現在の未確定打席」の pitches を取得する必要はない。
理由：投球データは打席確定時に一括保存するため、未確定の投球はDBに存在しない。
リロード時はカウント 0-0 に戻る（投球途中のリロードはデータロスになるが、仕様の「動くもの最速」方針で許容）。

## 完了要件チェックリスト

- [x] PitchCounter コンポーネントの作成（B/S/F カウント表示、投球ボタン3種、取り消しボタン）
- [x] AtBatInput に highlightCode prop を追加してハイライト表示
- [x] input/page.tsx に PitchCounter を組み込み、pitchLog state を管理
- [x] ボール4で「四球」ボタンがハイライト、ストライク3で「三振(空)」がハイライト
- [x] ファウルが2ストライク時にカウント増加しない
- [x] 取り消しで1球戻せる（ローカル state）
- [x] recordAtBatAction に pitchCount / pitches を追加し、一括 INSERT
- [x] 打席確定後にカウントをリセット
- [x] pnpm lint 通過
- [x] pnpm test 通過（既存テスト含む）
- [x] pnpm build 成功
