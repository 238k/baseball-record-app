# 野球試合記録アプリ 実装指示 Step 8
# 投手成績の自動集計

## 前提

Step 7が完了し、成績表示画面が動作していること。
現状 `pitching_records` の各カラム（`outs_recorded`, `hits`, `runs`, `earned_runs`, `walks`, `strikeouts`）は常に0のため、投手成績ビュー（`v_pitcher_game_stats`, `v_pitcher_career_stats`）が全て0を返す致命的なバグがある。

---

## このステップの目標

- 打席結果の記録時に、対戦投手の `pitching_records` を自動更新する
- 既存ビューの修正は不要（ビューは `pitching_records` のカラムを集計しており、カラムが正しければビューも正しくなる）

---

## 変更するファイル

```
app/(main)/games/
└── actions.ts              # recordAtBatAction に投手成績更新ロジックを追加
```

---

## 実装仕様

### recordAtBatAction への追加ロジック

打席結果の記録後、以下の手順で投手成績を更新する：

**1. 対戦投手の特定**

```typescript
// 打者のイニングハーフから守備側を判定
const fieldingSide = input.inningHalf === "top" ? "home" : "visitor"

// 守備側の現在の投手 = pitching_records で inning_to IS NULL のレコード
// ただし fieldingSide のラインナップに紐づくもの
```

**2. 結果に応じたカウント増分**

| result | outs_recorded | hits | walks | strikeouts |
|--------|--------------|------|-------|------------|
| `1B`, `2B`, `3B`, `HR` | 0 | +1 | 0 | 0 |
| `BB`, `IBB` | 0 | 0 | +1 | 0 |
| `HBP` | 0 | 0 | 0 | 0 |
| `K`, `KK` | +1 | 0 | 0 | +1 |
| `GO`, `FO`, `LO` | +1 | 0 | 0 | 0 |
| `DP` | +2 | 0 | 0 | 0 |
| `SF` | +1 | 0 | 0 | 0 |
| `SH` | +1 | 0 | 0 | 0 |
| `FC` | +1 | 0 | 0 | 0 |
| `E` | 0 | 0 | 0 | 0 |

※ `DP` のアウト数は走者のアウトも含むため +2（ランナーがいない場合のDPは通常ありえないが、念のため固定で+2とする）

**3. runs / earned_runs のカウント**

`runnerDestinations` の中で `event === "scored"` のものをカウントして `runs` に加算。
`earned_runs` も同値とする（エラーによる非自責点の区別は現スキーマでは不可能なため）。

**4. 更新クエリ**

```typescript
await supabase.rpc('increment_pitching_stats', {
  p_record_id: activePitcherRecord.id,
  p_outs: outsCount,
  p_hits: hitsCount,
  p_runs: runsCount,
  p_earned_runs: earnedRunsCount,
  p_walks: walksCount,
  p_strikeouts: strikeoutsCount,
})
```

もしくは素朴に現在値を取得してから update する。RPC を使う場合はマイグレーションで関数を作成する。

---

## 完了条件

- [ ] 打席を記録すると `pitching_records` の該当カラムが自動更新される
- [ ] 試合成績画面で投手の被安打・奪三振・与四球・防御率が正しく表示される
- [ ] 通算成績画面で投手成績が正しく集計される
- [ ] 投手交代後、新しい投手のレコードに正しく加算される
- [ ] `pnpm lint && pnpm build && pnpm test` がパスする

---
---
---

# 野球試合記録アプリ 実装指示 Step 9
# 盗塁・盗塁死の記録

## 前提

Step 8 が完了していること。
`runner_events` テーブルに `stolen_base` / `caught_stealing` の event_type は定義済みだが、記録する UI がない。

---

## このステップの目標

- 打席間に盗塁・盗塁死を記録できるようにする
- 成績ビュー（`v_batter_game_stats`, `v_batter_career_stats`）はすでに盗塁数・盗塁死数をカウントしているため、記録さえすれば反映される

---

## 追加・変更するファイル

```
components/game/
└── StealRecordDialog.tsx       # 新規：盗塁記録ダイアログ
app/(main)/games/[id]/
└── input/page.tsx              # 変更：盗塁ボタンを打席入力エリアに追加
app/(main)/games/
└── actions.ts                  # 変更：recordStealAction を追加
```

---

## 実装仕様

### StealRecordDialog コンポーネント

塁上にランナーがいる場合に「盗塁」ボタンを表示。
ダイアログで以下を選択：

```
┌──────────────────────────┐
│ 盗塁記録                   │
│                            │
│ 走者:  [1塁 田中 ▼]       │  ← 塁上の走者をセレクト
│ 結果:  [成功] [失敗]       │
│                            │
│ [記録する]   [キャンセル]    │
└──────────────────────────┘
```

- 成功: `event_type = 'stolen_base'`、走者を次の塁へ移動
- 失敗: `event_type = 'caught_stealing'`、走者を削除（アウト）+ アウトカウント+1

### recordStealAction

```typescript
export async function recordStealAction(input: {
  gameId: string
  atBatId: string     // 直前の打席IDに紐づける（runner_events は at_bat_id が必須）
  lineupId: string    // 走者
  eventType: 'stolen_base' | 'caught_stealing'
})
```

**注意**: `runner_events.at_bat_id` が NOT NULL のため、直前の打席を参照する必要がある。打席間の盗塁は直前の `at_bat_id` に紐づける。

### 盗塁時のゲーム状態更新

- 盗塁成功: `useGameState` の走者位置を更新（1塁→2塁、2塁→3塁、3塁→ホーム＝得点）
- 盗塁死: 走者を削除、アウトカウント+1（3アウトなら攻守交替）
- ホームスチール成功の場合は得点として `scored` イベントも追加

---

## 完了条件

- [ ] 打席入力画面で走者がいる場合に「盗塁」ボタンが表示される
- [ ] 盗塁成功を記録すると走者が次の塁に進む
- [ ] 盗塁死を記録するとアウトカウントが増える
- [ ] 成績画面で盗塁数が正しく表示される
- [ ] `pnpm lint && pnpm build && pnpm test` がパスする

---
---
---

# 野球試合記録アプリ 実装指示 Step 10
# 選手交代（代打・代走・守備変更）

## 前提

Step 9 が完了していること。
`lineups.inning_from` カラムが既に存在するが、常に 1 が入っており途中交代に使われていない。

---

## このステップの目標

- 代打・代走・守備位置変更を記録できるようにする
- 交代後の選手が以降の打席に正しく反映される
- 既存の投手交代（`changePitcherAction`）との整合性を保つ

---

## 追加・変更するファイル

```
components/game/
├── SubstitutionDialog.tsx      # 新規：代打・代走ダイアログ
└── PositionChangeDialog.tsx    # 新規：守備位置変更ダイアログ
app/(main)/games/[id]/
└── input/page.tsx              # 変更：交代ボタンを追加
app/(main)/games/
└── actions.ts                  # 変更：substitutePlayerAction, changePositionAction を追加
hooks/
└── useGameState.ts             # 変更：交代後のラインナップを反映
```

---

## 実装仕様

### 代打・代走の仕組み

1. 新しい `lineups` レコードを追加（同じ `batting_order`、`inning_from` = 現在のイニング）
2. `useGameState` でラインナップ取得時、同一 `batting_order` に複数レコードがある場合は `inning_from` が最も大きいものを現在の打者として扱う

### SubstitutionDialog

```
┌─────────────────────────────┐
│ 選手交代                      │
│                               │
│ 種別:  [代打] [代走]           │
│ 対象:  3番 田中 (左)           │
│ 交代選手: [控え選手一覧 ▼]     │  ← チームの players から未出場者
│ 守備:  [左 ▼]                 │  ← 代打時のみ。デフォルトは交代前と同じ
│                               │
│ [交代する]   [キャンセル]       │
└─────────────────────────────┘
```

### substitutePlayerAction

```typescript
export async function substitutePlayerAction(input: {
  gameId: string
  battingOrder: number
  teamSide: 'home' | 'visitor'
  newPlayerId: string | null
  newPlayerName: string
  newPosition: string
  currentInning: number
  type: 'pinch_hitter' | 'pinch_runner'
})
```

- 新しい lineups レコードを `inning_from = currentInning` で insert
- 代走の場合、現在の走者情報（base_runners の参照先 lineup_id）は変更不要（打席時に最新の lineup を参照するため）

### PositionChangeDialog

守備位置のみ変更（打順は維持）。選手を入れ替える場合は2人分の守備位置を同時変更。

### changePositionAction

```typescript
export async function changePositionAction(input: {
  gameId: string
  changes: { lineupId: string; newPosition: string }[]
  currentInning: number
})
```

---

## 完了条件

- [ ] 代打を記録すると以降の打順に新しい選手が表示される
- [ ] 代走を記録すると走者が交代する
- [ ] 守備位置変更が記録できる
- [ ] 交代後の選手が成績に正しく反映される
- [ ] `pnpm lint && pnpm build && pnpm test` がパスする

---
---
---

# 野球試合記録アプリ 実装指示 Step 11
# 試合管理・UX 改善

## 前提

Step 10 が完了していること。

---

## このステップの目標

- 試合の編集・削除機能を追加する
- プロフィール編集画面を追加する
- 各種 UX を改善する

---

## 追加・変更するファイル

```
app/(main)/games/[id]/
└── edit/page.tsx               # 新規：試合情報編集
app/(main)/
└── settings/page.tsx           # 新規：プロフィール設定
app/(main)/games/
└── actions.ts                  # 変更：updateGameAction, deleteGameAction を追加
app/(main)/
└── settings/actions.ts         # 新規：updateProfileAction
app/(main)/layout.tsx           # 変更：ヘッダーに設定リンク追加
```

---

## 実装仕様

### 1. 試合編集 `/games/[id]/edit`

試合情報（相手チーム名、日付、場所、ホーム/ビジター）を編集可能にする。
`scheduled` ステータスの試合のみ編集可能。`in_progress` / `finished` は読み取り専用。

### 2. 試合削除

`scheduled` ステータスの試合のみ削除可能。
`AlertDialog` で確認後、cascade で関連データ（lineups, pitching_records 等）を自動削除。

### 3. プロフィール設定 `/settings`

- 表示名の変更
- ヘッダーのユーザー名横に歯車アイコンで遷移

### 4. UX 改善

- **観戦画面からの導線**: `finished` ステータスの観戦画面に「試合成績を見る」リンクを追加（試合詳細の成績タブへ）
- **試合詳細ページ**: `scheduled` ステータスで「試合開始」ボタンを追加（オーダー登録済みの場合のみ）

---

## 完了条件

- [ ] 試合前の試合情報を編集できる
- [ ] 試合前の試合を削除できる（確認ダイアログあり）
- [ ] プロフィール設定で表示名を変更できる
- [ ] 観戦画面から試合成績へ遷移できる
- [ ] `pnpm lint && pnpm build && pnpm test` がパスする
