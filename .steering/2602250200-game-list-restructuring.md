# 試合管理画面のリストラクチャリング

## 概要
トップページに全試合が表示されていて情報が多くわかりにくいため、画面遷移を整理する。

## 完了要件チェックリスト

### Phase 1: 共有コンポーネントの抽出・作成
- [x] `components/game/LineupTable.tsx` を抽出（現detail pageのLineupTable関数を独立化）
- [x] `components/game/TodayGameCard.tsx` を新規作成（ステータス別アクションボタン付き）
- [x] `hooks/useGameState.ts` の `GameInfo` に `game_date`, `location` を追加

### Phase 2: 試合一覧ページの作成
- [x] `app/(main)/games/page.tsx` を新規作成（現トップページの試合一覧ロジックを移植）

### Phase 3: 統合された試合詳細+観戦ページ
- [x] `components/game/GameDetailClient.tsx` を新規作成（ステータス別UI出し分け）
- [x] `app/(main)/games/[id]/page.tsx` を薄いServer Componentに書き換え

### Phase 4: トップページの修正
- [x] `app/(main)/page.tsx` を本日の試合のみ表示に修正

### Phase 5: ナビゲーション修正
- [x] `app/(main)/games/[id]/lineup/page.tsx` の試合開始後遷移先を `/input` に変更
- [x] `app/(main)/games/[id]/spectate/page.tsx` をリダイレクトに置換
- [x] `app/(main)/games/actions.ts` に `revalidatePath("/games")` 追加

### Phase 6: テスト
- [x] `components/game/TodayGameCard.test.tsx` (5 tests)
- [x] `components/game/GameDetailClient.test.tsx` (6 tests)
- [x] `components/game/LineupTable.test.tsx` (4 tests)

### 最終確認
- [x] `pnpm test` 全テスト通過 (190 tests, 17 files)
- [x] `pnpm build` ビルドエラーなし
