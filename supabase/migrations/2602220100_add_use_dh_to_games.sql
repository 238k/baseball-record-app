-- games テーブルに DH制 フラグを追加
ALTER TABLE games ADD COLUMN use_dh boolean NOT NULL DEFAULT false;
