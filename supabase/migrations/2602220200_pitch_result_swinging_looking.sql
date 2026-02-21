-- pitches.result の CHECK 制約を変更:
-- 'strike' を 'swinging'(空振り) と 'looking'(見逃し) に分離

-- 既存の 'strike' データを 'swinging' に変換
update pitches set result = 'swinging' where result = 'strike';

-- 既存の CHECK 制約を削除して再作成
alter table pitches drop constraint if exists pitches_result_check;
alter table pitches add constraint pitches_result_check
  check (result in ('ball', 'swinging', 'looking', 'foul', 'hit', 'out'));
