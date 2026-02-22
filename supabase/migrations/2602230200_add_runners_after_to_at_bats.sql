-- at_bats に打席結果後の走者位置を保存する runners_after カラムを追加
-- 例: [{"base":"1st","lineup_id":"xxx"},{"base":"3rd","lineup_id":"yyy"}]
-- computeRunnersAfterAtBat の推論に頼らず、ユーザーが選んだ実際の走者位置を復元できるようにする
alter table at_bats add column runners_after jsonb;
