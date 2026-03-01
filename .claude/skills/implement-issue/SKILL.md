---
name: implement-issue
description: GitHub issue を指定して実装を進める。issue番号を受け取り、gh コマンドで内容を取得した上で /implement ワークフローに沿って自律的に実装する。「issue #3 を実装して」「#5 を対応して」「issue 7 をやって」など、issue番号を指定した実装依頼に使用する。issue起点の実装・対応依頼があれば積極的にこのスキルを使うこと。
argument-hint: "<issue番号> (例: 3, #5)"
---

GitHub issue を指定して、その内容に基づき `/implement` ワークフローで実装を進めるスキルです。

## ワークフロー

### ステップ 1: issue 内容の取得

引数（$ARGUMENTS）から issue 番号を抽出し、`gh` コマンドで詳細を取得する。

```bash
gh issue view <番号>
```

issue が存在しない場合やクローズ済みの場合はユーザーに報告して終了する。

### ステップ 2: 実装ブランチの作成

issue 番号に基づいたブランチを作成して切り替える。

```bash
git checkout -b issue-<番号>-<短い英語の機能名>
```

- ブランチ名の機能名部分は issue タイトルから簡潔に英語で付ける
- 例: `issue-4-tab-navigation`, `issue-5-expand-tap-area`
- 既にブランチが存在する場合はそのブランチに切り替える

### ステップ 3: /implement ワークフローの実行

取得した issue の内容を実装依頼として、以下の `/implement` ワークフローを実行する。

1. **コードベースの調査** — issue の内容に関連するファイル・コンポーネント・スキーマを調査
2. **Steeringドキュメントの作成** — `.steering/YYMMDDhhmm-機能名.md` に作業計画を作成
   - issue の URL を概要セクションに記載する（例: `関連 issue: #4`）
   - issue の本文から背景・要件を反映する
3. **セルフレビュー** — 作業内容の漏れ・CLAUDE.md 規約との整合性を確認
4. **自律実装** — チェックリストをすべて完了するまで実装を継続

### ステップ 4: 完了報告

実装完了後、以下を報告する：

- 変更内容のサマリー
- PR 作成を提案する（`gh pr create` で issue を参照）

## 重要なルール

- issue の内容が曖昧な場合は、実装前にユーザーに確認する
- `/implement` のルールをすべて引き継ぐ（チェックリスト完了まで中断しない等）
- CLAUDE.md の規約を必ず守る
- ブランチは main から作成する（最新の main を確認してから）
