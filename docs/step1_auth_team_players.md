# 野球試合記録アプリ 実装指示 Step 1
# 認証・チーム管理・選手登録

## このステップの目標

以下が動作する状態にしてください：
- ログイン・新規登録ができる
- チームを作成できる
- 招待コードで他のユーザーがチームに参加できる
- 選手を登録・編集・削除できる
- トップ画面にチームの情報が表示される

---

## 技術スタック

- Next.js 16（App Router）、TypeScript
- Tailwind CSS
- **shadcn/ui**（UIコンポーネントライブラリ）
- Supabase（認証・DB・RLS設定済み）
- デプロイ先：Vercel

## 環境変数（.env.localに設定済みであること）

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Step 0: 初期セットアップ

### shadcn/ui のインストール

```bash
npx shadcn@latest init
```

設定は以下を選択してください：
- Style: Default
- Base color: Gray
- CSS variables: Yes

次に必要なコンポーネントを追加してください：

```bash
npx shadcn@latest add button input label card dialog select tabs badge toast avatar separator
```

### Supabaseセットアップ（MCP経由）

まず、添付の `supabase_schema_v2.sql` の内容を以下のパスに配置してください：

```
supabase/migrations/20240101000000_initial_schema.sql
```

次に、**Supabase MCPを使って上記ファイルをSupabaseプロジェクトに適用してください。**

実行後、以下を確認してください：
- 全テーブルが作成されていること
- 全VIEWが作成されていること
- RLSポリシーが設定されていること

次にSupabase CLIで型定義を生成してください：
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts
```

Supabaseダッシュボードで以下を設定してください：
- Authentication > Providers > Google を有効化
- Authentication > Providers > Email を有効化

---

## ディレクトリ構成（このステップで作成するもの）

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # ログイン画面
│   │   └── register/page.tsx       # 新規登録画面
│   ├── (main)/
│   │   ├── layout.tsx              # 認証チェック・ナビゲーション
│   │   ├── page.tsx                # トップ（試合一覧・後のステップで充実）
│   │   └── team/
│   │       ├── new/page.tsx        # チーム作成
│   │       └── [id]/
│   │           ├── page.tsx        # チーム管理トップ
│   │           ├── players/page.tsx  # 選手一覧・登録・編集
│   │           └── invite/page.tsx   # 招待コード・メンバー管理
│   └── layout.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # ブラウザ用クライアント
│   │   ├── server.ts               # サーバー用クライアント
│   │   └── types.ts                # 自動生成
│   └── utils.ts
├── components/
│   ├── auth/
│   │   └── AuthForm.tsx
│   ├── team/
│   │   ├── TeamCard.tsx
│   │   ├── PlayerForm.tsx
│   │   └── MemberList.tsx
│   └── ui/                         # shadcn/uiが自動生成（手動作成不要）
└── middleware.ts
```

---

## 実装仕様

### middleware.ts

未認証ユーザーを `/login` にリダイレクト。
`/login` と `/register` は認証不要。

### ログイン画面 `/login`

- Googleログインボタン
- メールアドレス＋パスワードのフォーム
- 「新規登録はこちら」リンク

### 新規登録画面 `/register`

- 表示名・メールアドレス・パスワードのフォーム
- 登録後は自動ログインしてトップへ遷移

### トップ画面 `/`（このステップでは簡易版）

- ログイン中のユーザーが所属するチームの一覧を表示
- 「チームを作成」ボタン
- 「チームに参加」ボタン（招待コード入力）
- チームがない場合はチーム作成を促すメッセージ

### チーム作成 `/team/new`

- チーム名を入力して作成
- 作成後はチーム管理画面へ遷移
- DBトリガーで作成者がadminに自動設定される

### チーム管理 `/team/[id]`

- チーム名・招待コードを表示
- 「選手管理」「招待・メンバー管理」へのリンク
- adminのみ：チーム名編集ボタン

### 選手管理 `/team/[id]/players`

**一覧表示：**
- 背番号・名前・ポジションの一覧（背番号順）
- is_active=trueの選手のみデフォルト表示
- 「引退選手を表示」トグル

**登録・編集：**
- 名前（必須）・背番号・ポジションを入力
- モーダルまたはフォームで登録・編集
- 削除は「引退」扱い（is_active=falseに変更）にして成績データを保持

### 招待・メンバー管理 `/team/[id]/invite`

**招待コード：**
- 現在の招待コードを表示
- 「コードを再発行」ボタン（adminのみ）
- コピーボタン

**メンバー一覧：**
- 名前・ロール（admin/member）の一覧
- adminのみ：メンバーをadminに昇格、チームから削除

**チーム参加（トップ画面から）：**
- 招待コードを入力して参加
- Server Actionで `team_members` にレコードを作成

---

## UI・UX要件

- タブレット（iPad）での操作を主に想定
- shadcn/uiのコンポーネントを積極的に使用すること
- shadcn/uiのButtonは `size="lg"` を基本とし、重要なアクションは追加で `className="min-h-16 text-lg"` を指定
- shadcn/uiのInputは `className="text-lg h-14"` を基本としタップしやすいサイズに
- ローディング中はButtonに `disabled` と `loading` 状態を設定してスピナーを表示
- エラーはフォームの近くに赤文字で表示（shadcn/uiの `FormMessage` を使用）
- モーダルはshadcn/uiの `Dialog` コンポーネントを使用

---

## 完了条件

以下をすべて手動で確認できること：

- [ ] メールアドレスで新規登録・ログインができる
- [ ] Googleアカウントでログインができる
- [ ] ログアウトができる
- [ ] 未認証状態でトップにアクセスするとログイン画面にリダイレクトされる
- [ ] チームを作成できる
- [ ] 作成したチームがトップ画面に表示される
- [ ] 招待コードを別アカウントで入力してチームに参加できる
- [ ] 選手を登録・編集・引退（削除）できる
- [ ] adminがメンバーを削除できる
