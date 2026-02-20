# 野球試合記録アプリ 実装指示 Step 4
# 投球カウント入力の追加

## 前提

Step 3が完了し、打席結果の入力が動作していること。
shadcn/uiがインストール済みであること。

---

## このステップの目標

打席結果入力に投球カウント（ボール・ストライク・ファウル）を追加する。

---

## 変更するファイル

```
src/
├── components/game/
│   └── PitchCounter.tsx        # 新規作成
└── app/(main)/games/[id]/
    └── input/page.tsx          # PitchCounterを組み込む
```

---

## 実装仕様

### PitchCounter コンポーネント

shadcn/uiの `Button`・`Badge` を使用してください。
ボタンは `size="lg"` で大きめに、カウント表示は `Badge` を活用してください。

```
┌────────────────────────────────┐
│  カウント  B●●○  S●○  F●●      │  ← 現在のカウント表示
├────────────────────────────────┤
│  [ボール]  [ストライク]  [ファウル]│  ← 投球入力ボタン
│  [取り消し（1球戻す）]           │
└────────────────────────────────┘
```

**カウントのルール：**
- ボール4→四球（自動で打席結果「四球」を設定）
- ストライク3→三振（自動で打席結果選択を「三振(空)」にセット）
- ファウルは2ストライクでカウントが増えない
- 投球ごとに `pitches` テーブルにレコードを保存

**取り消しボタン：**
- 直前の1球を削除（`pitches` の最後のレコードを削除）
- カウントを1つ戻す

**打席結果との連携：**
- ボール4・ストライク3になると対応するボタンをハイライトして誘導
- 最終的な打席結果ボタンは引き続き手動で押して確定

---

## 完了条件

- [ ] ボール・ストライク・ファウルのカウントが正しく表示される
- [ ] ボール4で四球の打席結果ボタンがハイライトされる
- [ ] ストライク3で三振ボタンがハイライトされる
- [ ] 取り消しで1球戻せる
- [ ] 投球データが `pitches` テーブルに保存される
- [ ] `at_bats.pitch_count` に投球数が保存される

---
---
---

# 野球試合記録アプリ 実装指示 Step 5
# 排他制御の実装

## 前提

Step 3または4が完了し、記録入力画面が動作していること。

---

## このステップの目標

- 1試合につき1人だけが入力できる排他制御を実装する
- 入力権の申請・承認・タイムアウトを実装する
- 管理者による強制解除を実装する

---

## 追加・変更するファイル

```
src/
├── hooks/
│   └── useGameSession.ts           # 排他制御フック（新規）
├── components/game/
│   ├── InputLockBanner.tsx          # 入力中表示バナー（新規）
│   └── SessionRequestModal.tsx      # 申請通知モーダル（新規）
└── app/(main)/games/[id]/
    └── input/page.tsx               # 排他制御を組み込む
```

---

## 実装仕様

### useGameSession フック

```typescript
type UseGameSessionReturn = {
  isMySession: boolean        // 自分が入力権を持っているか
  currentHolder: Profile | null  // 現在の入力者
  isStale: boolean            // 5分以上操作なし（申請可能状態）
  requestSession: () => Promise<void>   // 入力権を申請
  releaseSession: () => Promise<void>   // 入力権を手放す
  pendingRequest: GameInputRequest | null  // 受け取った申請
  approveRequest: (requestId: string) => Promise<void>
  rejectRequest: (requestId: string) => Promise<void>
}
```

**セッション取得フロー：**
1. 入力画面に入ったとき `game_input_sessions` を確認
2. セッションなし → 自分のセッションを作成して入力開始
3. 自分のセッション → そのまま入力継続
4. 他者のセッション（5分以内） → 入力ロック表示
5. 他者のセッション（5分超） → 申請ボタン表示

**ハートビート：**
- `isMySession=true` の間、5秒ごとに `last_active_at` を更新
- `useEffect` のクリーンアップでセッションを削除

**タイムアウト処理：**
- `pending` 状態の申請が60秒経過したら自動承認
- `useEffect` 内で `setInterval` で監視

### InputLockBanner コンポーネント

shadcn/uiの `Alert` コンポーネントを使用してください。

他者が入力中のときに画面上部に表示：

```
┌─────────────────────────────────────────┐
│ 🔒 田中さんが入力中です                   │
│ [入力権を申請する]  ← isStale=trueのみ表示│
└─────────────────────────────────────────┘
```

### SessionRequestModal コンポーネント

shadcn/uiの `Dialog` を使用してください。

申請が来たときに表示：

```
┌─────────────────────────────┐
│ 鈴木さんが入力権を申請しています │
│ 残り: 45秒                   │
│ [承認する]   [断る]           │
└─────────────────────────────┘
```

### 管理者強制解除

チーム管理画面 `/team/[id]` に「試合中の入力セッション」セクションを追加：
- 現在セッション中の試合一覧
- 「強制解除」ボタン（adminのみ表示）
- `game_input_sessions` のレコードを削除するだけ

---

## 完了条件

- [ ] 入力画面に入るとセッションが作成される
- [ ] 別のブラウザ/タブで開くと「〇〇が入力中」バナーが表示される
- [ ] 5分操作しないと申請ボタンが表示される
- [ ] 申請すると入力者にモーダルが表示される
- [ ] 承認するとセッションが移譲される
- [ ] 60秒無応答で自動承認される
- [ ] 管理者が強制解除できる
- [ ] 画面を離れるとセッションが削除される

---
---
---

# 野球試合記録アプリ 実装指示 Step 6
# リアルタイム観戦画面

## 前提

Step 3〜5が完了していること。

---

## このステップの目標

試合詳細画面をリアルタイムで自動更新される観戦画面に仕上げる。

---

## 変更するファイル

```
src/
├── hooks/
│   └── useRealtimeGame.ts          # Realtime購読フック（新規）
└── app/(main)/games/[id]/
    └── page.tsx                    # 観戦画面に仕上げる
```

---

## 実装仕様

### Supabase Realtimeの設定

**Supabase MCPを使って以下のテーブルのRealtimeを有効化してください：**
- `game_input_sessions`
- `game_input_requests`
- `at_bats`
- `base_runners`
- `runner_events`
- `games`

### useRealtimeGame フック

```typescript
// 以下のテーブルをSubscribeして状態を自動更新
const channels = [
  'at_bats',
  'base_runners',
  'runner_events',
  'games',
  'game_input_sessions',
]
```

### 観戦画面のUI

```
┌─────────────────────────────────────┐
│        自チーム  3 - 2  相手         │  ← 大きなスコア表示
├──────┬──────┬──────┬──────┬──────┬──┤
│  回  │  1   │  2   │  3   │ ... │ 計│  ← イニング別スコア
│ 自   │  0   │  2   │  1   │     │ 3 │
│ 相   │  0   │  1   │  1   │     │ 2 │
├─────────────────────────────────────┤
│  3回表  ●●○ アウト                  │
│  走者: [1塁●] [2塁○] [3塁○]        │
│  打者: #3 田中  投手: #18 山田       │
├─────────────────────────────────────┤
│  直近の記録                          │
│  田中 → 単打（1打点）               │
│  鈴木 → 四球                        │
│  佐藤 → 三振                        │
└─────────────────────────────────────┘
```

---

## 完了条件

- [ ] 記録入力画面で結果を入力すると観戦画面が自動更新される
- [ ] スコアが正しく表示される
- [ ] イニング別スコアが表示される
- [ ] 走者状況がリアルタイムで更新される
- [ ] 直近の打席結果ログが表示される
- [ ] 入力者の名前が表示される

---
---
---

# 野球試合記録アプリ 実装指示 Step 7
# 成績表示画面

## 前提

Step 3〜6が完了していること。
SupabaseにVIEW（v_batter_game_stats, v_batter_career_stats, v_pitcher_game_stats, v_pitcher_career_stats）が作成済みであること。

---

## このステップの目標

- 試合ごとの打者・投手成績を表示する
- 選手の通算成績を表示する

---

## 追加するファイル

```
src/
├── app/(main)/
│   ├── games/[id]/
│   │   └── page.tsx              # 試合成績タブを追加
│   └── team/[id]/
│       └── stats/page.tsx        # チーム通算成績
├── components/
│   └── stats/
│       ├── BatterStatsTable.tsx  # 打者成績テーブル
│       └── PitcherStatsTable.tsx # 投手成績テーブル
```

---

## 実装仕様

### 成績テーブルのUI

shadcn/uiの `Table`（`TableHeader`・`TableBody`・`TableRow`・`TableCell`）を使用してください。
数値は右揃え、名前は左揃えとすること。

まだインストールしていない場合は追加してください：
```bash
npx shadcn@latest add table
```

**VIEWから直接取得する（TypeScriptでの集計は不要）：**

```typescript
// 試合の打者成績
const { data } = await supabase
  .from('v_batter_game_stats')
  .select('*')
  .eq('game_id', gameId)
  .order('batting_order')

// 通算成績
const { data } = await supabase
  .from('v_batter_career_stats')
  .select('*')
  .eq('team_id', teamId)
```

### 割り算の表示（TypeScript側で実施）

```typescript
// 打率（3桁表示・0除算考慮）
const formatAvg = (hits: number, atBats: number) =>
  atBats === 0 ? '---' : (hits / atBats).toFixed(3).replace(/^0/, '')

// 出塁率
const formatObp = (hits: number, walks: number, hbp: number, atBats: number, sacFlies: number) => {
  const denom = atBats + walks + hbp + sacFlies
  return denom === 0 ? '---' : ((hits + walks + hbp) / denom).toFixed(3).replace(/^0/, '')
}

// 防御率
const formatEra = (earnedRuns: number, outs: number) =>
  outs === 0 ? '---' : (earnedRuns * 27 / outs).toFixed(2)

// 投球回（6.1 = 6回1/3）
const formatIp = (outs: number) =>
  `${Math.floor(outs / 3)}.${outs % 3}`
```

### 試合詳細画面の成績タブ

試合詳細画面にタブを追加：
- 「試合情報」タブ（既存）
- 「打者成績」タブ
- 「投手成績」タブ

**打者成績テーブルの列：**
打順・名前・打席・打数・安打・打率・打点・得点・本塁打・盗塁・三振・四球

**投手成績テーブルの列：**
名前・投球回・被安打・失点・自責点・防御率・奪三振・与四球

### チーム通算成績 `/team/[id]/stats`

**打者成績テーブル（試合数5以上の選手に絞るなど適宜フィルタ）：**
名前・試合・打席・打数・打率・出塁率・長打率・OPS・打点・得点・本塁打・盗塁

**投手成績テーブル：**
名前・登板・投球回・防御率・奪三振・与四球・被安打

---

## 完了条件

- [ ] 試合詳細で打者成績テーブルが表示される
- [ ] 試合詳細で投手成績テーブルが表示される
- [ ] 打率・出塁率・防御率が正しく計算・表示される
- [ ] 0打数の場合は「---」と表示される
- [ ] チーム通算成績ページで全選手の成績が確認できる
