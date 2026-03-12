# バリデーション戦略

## 基本方針

**Zod スキーマをクライアント・サーバーで共有し、ドメイン値はリテラル型で厳密に定義する。**

## スキーマの配置

```
app/(main)/games/
  validation.ts         # ゲーム関連の Zod スキーマ
  actions.ts            # Server Action（validation.ts を import）

lib/game/
  schemas.ts            # ドメイン共通の定数・型（結果コード、ポジション等）
```

## ドメイン値の定義

### 打席結果コード

```typescript
// lib/game/schemas.ts
import { z } from "zod";

export const AT_BAT_RESULTS = [
  "1B", "2B", "3B", "HR",           // 安打
  "BB", "IBB", "HBP",               // 四死球
  "K", "KK",                        // 三振（空振り / 見逃し）
  "GO", "FO", "LO", "DP",           // アウト
  "SF", "SH", "FC", "E",            // その他
] as const;

export const atBatResultSchema = z.enum(AT_BAT_RESULTS);
export type AtBatResult = z.infer<typeof atBatResultSchema>;
```

### 守備ポジション

```typescript
export const POSITIONS = ["投", "捕", "一", "二", "三", "遊", "左", "中", "右", "DH"] as const;
export const positionSchema = z.enum(POSITIONS);
export type Position = z.infer<typeof positionSchema>;
```

### 塁

```typescript
export const BASES = ["1st", "2nd", "3rd"] as const;
export const baseSchema = z.enum(BASES);
export type Base = z.infer<typeof baseSchema>;
```

### 投球結果

```typescript
export const PITCH_RESULTS = ["B", "S", "F", "X"] as const;
export const pitchResultSchema = z.enum(PITCH_RESULTS);
export type PitchResult = z.infer<typeof pitchResultSchema>;
```

## バリデーションの責務分担

| レイヤー | 検証内容 | 例 |
|---------|---------|-----|
| **UI（Client Component）** | UI制約による暗黙的バリデーション | ボタン選択式で無効値を選べない |
| **Server Action** | Zod スキーマで入力検証 + ビジネスルール検証 | `parseOrError(schema, input)` + ステータスチェック |
| **DB（RLS / CHECK）** | 最終防衛ライン | RLS ポリシー、FK制約、CHECK制約 |

### 検証フロー

```
ユーザー操作
  ↓
Client Component（UI制約で無効値を排除）
  ↓
Server Action（Zod スキーマで型検証 → ビジネスルール検証）
  ↓
Database（RLS + 制約で最終チェック）
```

## parseOrError ヘルパー

```typescript
// app/(main)/games/validation.ts
export function parseOrError<T>(
  schema: z.ZodType<T>,
  data: unknown
): { data: T; error?: never } | { data?: never; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { error: result.error.errors[0]?.message ?? "入力が不正です" };
  }
  return { data: result.data };
}
```

- 最初のエラーメッセージのみ返す（ユーザーに大量のエラーを見せない）
- Server Action の冒頭で使用

## 現状の課題と改善方針

### 現状

- `validation.ts` に Zod スキーマがあるが、一部のスキーマでドメイン値が `z.string()` のみ
- `recordAtBatSchema` の `base` が `z.string()` で `"4th"` 等を許容
- `changePositionSchema` の `position` が `z.string().min(1)` のみ
- クライアント側（`input/page.tsx`）が Zod を使わず手動バリデーション

### 改善方針

1. `lib/game/schemas.ts` にドメイン値のリテラル型を集約
2. `validation.ts` の各スキーマをリテラル型に置き換え
3. クライアント側の手動バリデーションを共有スキーマに置き換え
4. 新しいスキーマ作成時は必ずリテラル型を使用
