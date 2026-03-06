# ランナー操作時にホームインするランナーをホームベース上に移動表示する

関連 issue: #3

## 概要

得点したランナーの移動先をフィールド上部（DEST_ZONES.scored: y=55）からホームベース位置（BASE_POSITIONS.home: y=350）に変更し、ホームインの動きを視覚的に表現する。

## 実装

- `DEST_COORDS.scored` の座標を `DEST_ZONES.scored` から `BASE_POSITIONS.home` に変更
- 得点ゾーンのタップターゲット（zone-scored）の位置はそのまま維持（フィールド上部）

## チェックリスト

- [x] scored の移動先をホームベース座標に変更
- [x] テスト全通過
