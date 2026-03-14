# 各ルートに error.tsx を追加

関連 issue: #20

## 概要

予期しないエラー発生時にユーザーに適切なフィードバックを表示し、復旧手段（リトライ・ホームに戻る）を提供する。

## 現状

- error.tsx が1つも存在しない
- サーバーコンポーネントでの fetch 失敗時、Next.js デフォルトのエラー画面が表示される

## 作業内容

4箇所に error.tsx を追加する。すべて "use client" のクライアントコンポーネント（Next.js の仕様）。

### 対象ファイル

1. `app/(main)/error.tsx` — メインレイアウト共通エラー境界
2. `app/(main)/games/[id]/error.tsx` — 試合詳細エラー境界
3. `app/(main)/games/[id]/input/error.tsx` — 試合入力エラー境界（データ損失リスクが高い）
4. `app/(auth)/error.tsx` — 認証系エラー境界

### UI 設計

- 既存の loading.tsx と同様にセンタリング配置
- shadcn/ui の Button コンポーネントを使用
- リトライボタン（`reset()` 呼び出し）+ ホームに戻るボタン
- エラーメッセージはユーザーフレンドリーな日本語
- `text-destructive` でエラー表示、`text-muted-foreground` で補足テキスト
- 試合入力画面のエラーには「入力内容が失われる可能性」の注意文言を追加

### テスト

- error.tsx はNext.jsのエラー境界のため、props（error, reset）のインターフェースが決まっている
- 各コンポーネントのレンダリングテストを作成

## チェックリスト

- [x] `app/(main)/error.tsx` 作成
- [x] `app/(main)/games/[id]/error.tsx` 作成
- [x] `app/(main)/games/[id]/input/error.tsx` 作成
- [x] `app/(auth)/error.tsx` 作成
- [x] 各 error.tsx にリトライ・ナビゲーションボタンを設置
- [x] テスト作成・パス (25ファイル / 282テスト all pass)
- [x] `pnpm build` 成功
