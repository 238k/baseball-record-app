# コンポーネント設計ガイドライン

## ファイルサイズ制限

**1コンポーネントファイルは300行以下** を目安とする。超える場合は分割を検討する。

良い例:
- `OutCount.tsx` (26行) — 純粋な表示コンポーネント
- `ScoreBoard.tsx` (38行) — props からの計算と表示のみ
- `GameCard.tsx` (138行) — ヘルパー関数 + 条件付きレンダリング
- `AtBatInput.tsx` (154行) — 1つの useState + カテゴリ選択UI

改善が必要な例:
- `GameDetailClient.tsx` (386行) — データ取得とUI表示が混在
- `LineupEditor.tsx` (320行) — DnDロジックとUI表示が混在

## useState の管理

**useState が3個を超えたら `useReducer` または Zustand ストアの使用を検討する。**

```tsx
// NG: 並列する state が多すぎる
const [dialogOpen, setDialogOpen] = useState(false);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [selectedItem, setSelectedItem] = useState<string | null>(null);
const [confirmOpen, setConfirmOpen] = useState(false);

// OK: reducer で状態遷移を明示
type State = {
  dialogOpen: boolean;
  loading: boolean;
  error: string | null;
  selectedItem: string | null;
  confirmOpen: boolean;
};

type Action =
  | { type: "OPEN_DIALOG"; item: string }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_ERROR"; error: string }
  | { type: "CLOSE" };
```

特に**同じ概念を複数の state で表現している場合**は必ず統合する:

```tsx
// NG: ポジション変更を3つの state で管理
const [posChanges, setPosChanges] = useState<Record<string, string>>({});
const [posSubstitutions, setPosSubstitutions] = useState<Record<string, {...}>>({});
const [posSubManualInput, setPosSubManualInput] = useState<Set<string>>(new Set());

// OK: 単一の構造で管理
type PositionChange = {
  lineupId: string;
  newPosition: string;
  substitute?: { playerId: string | null; playerName: string; isManual: boolean };
};
const [posChanges, dispatch] = useReducer(posChangeReducer, []);
```

## ビジネスロジックの分離

**ビジネスロジック（計算・判定・変換）はコンポーネント外の `lib/` に配置する。**

コンポーネント内に置いてよいもの:
- UI状態の管理（開閉、選択、ホバー）
- イベントハンドラ（Server Action の呼び出し、ルーティング）
- 表示用の軽い変換（日付フォーマット等）

`lib/` に分離すべきもの:
- ドメインロジック（ランナー進塁計算、RBI算出、アウトカウント）
- 複雑な条件分岐（フォースアウト判定、DH制ルール適用）
- データ変換（DBレコードからUI用の構造への変換）

```
lib/
  game/
    runner-logic.ts      # ランナー進塁デフォルト値、フォース判定
    rbi-logic.ts         # RBI算出
    at-bat-logic.ts      # 打席結果に応じたアウトカウント
    state-reconstruction.ts  # at_bats からのゲーム状態再構築
```

**分離の基準**: 「このロジックにユニットテストを書きたいか？」→ Yes なら `lib/` に分離する。

## Presentational / Container の分離

### Page コンポーネント（Container）

```tsx
// app/(main)/games/[id]/page.tsx — Server Component
export default async function GameDetailPage({ params }: Props) {
  const game = await fetchGame(params.id);       // データ取得
  const lineups = await fetchLineups(params.id);  // データ取得
  return <GameDetail game={game} lineups={lineups} />;  // Client に渡す
}
```

- サーバー側でデータを取得し、Client Component に渡す
- Client Component は受け取った props で表示とインタラクションを担当

### 表示コンポーネント（Presentational）

```tsx
// components/game/OutCount.tsx — 純粋な表示
type Props = { outs: number; max?: number };

export function OutCount({ outs, max = 3 }: Props) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={cn("h-4 w-4 rounded-full", i < outs ? "bg-yellow-500" : "bg-gray-200")} />
      ))}
    </div>
  );
}
```

- props のみに依存
- 副作用なし（fetch、subscribe、navigate なし）
- テストが容易

## フォーム状態管理パターン

### ダイアログフォーム（標準パターン）

```tsx
export function EditDialog({ defaultValue, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await someAction(value);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setOpen(false);
    setValue(defaultValue);
    onSaved();
  };

  // ...
}
```

- `open`, `loading`, `error` の3つは許容（ダイアログフォームの最小セット）
- 成功時: ダイアログを閉じ、フォームをリセット、親コールバック呼び出し
- 失敗時: エラー表示、loading 解除

## タッチターゲット（タブレット最適化）

本アプリは iPad 縦向きでの使用を想定しているため、タッチターゲットは大きめに設定する。

```tsx
// 主要アクションボタン
<Button size="lg" className="min-h-16 text-lg">アクション</Button>

// 通常ボタン
<Button size="lg" className="min-h-14 text-lg">ボタン</Button>

// レスポンシブ対応
<Button className="min-h-11 sm:min-h-14 text-base sm:text-lg">ボタン</Button>

// 入力フィールド
<Input className="text-lg h-14" />
```
