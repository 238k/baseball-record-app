-- =====================================================
-- FK列およびクエリ頻出カラムへのインデックス追加
-- 関連 issue: #17
-- =====================================================

-- at_bats
CREATE INDEX idx_at_bats_game_id ON at_bats(game_id);
CREATE INDEX idx_at_bats_lineup_id ON at_bats(lineup_id);
CREATE INDEX idx_at_bats_recorded_by ON at_bats(recorded_by);

-- lineups
CREATE INDEX idx_lineups_game_id ON lineups(game_id);

-- team_members
CREATE INDEX idx_team_members_profile_id ON team_members(profile_id);

-- players
CREATE INDEX idx_players_team_id ON players(team_id);

-- games
CREATE INDEX idx_games_team_id ON games(team_id);
CREATE INDEX idx_games_created_by ON games(created_by);

-- game_input_sessions
-- game_id は UNIQUE 制約で既にインデックスあり。profile_id のみ追加
CREATE INDEX idx_game_input_sessions_profile_id ON game_input_sessions(profile_id);

-- game_input_requests
CREATE INDEX idx_game_input_requests_game_id ON game_input_requests(game_id);
CREATE INDEX idx_game_input_requests_requester_id ON game_input_requests(requester_id);

-- pitches
CREATE INDEX idx_pitches_at_bat_id ON pitches(at_bat_id);

-- base_runners
CREATE INDEX idx_base_runners_game_id ON base_runners(game_id);
CREATE INDEX idx_base_runners_at_bat_id ON base_runners(at_bat_id);
CREATE INDEX idx_base_runners_lineup_id ON base_runners(lineup_id);

-- runner_events
CREATE INDEX idx_runner_events_at_bat_id ON runner_events(at_bat_id);
CREATE INDEX idx_runner_events_lineup_id ON runner_events(lineup_id);

-- pitching_records
CREATE INDEX idx_pitching_records_game_id ON pitching_records(game_id);
CREATE INDEX idx_pitching_records_lineup_id ON pitching_records(lineup_id);

-- =====================================================
-- 複合インデックス（クエリパターンに基づく最適化）
-- =====================================================

-- 試合の全打席を時系列で取得（最新の打席取得パターン）
CREATE INDEX idx_at_bats_game_created ON at_bats(game_id, created_at DESC);

-- 試合のチーム別ラインナップ取得
CREATE INDEX idx_lineups_game_side ON lineups(game_id, team_side);
