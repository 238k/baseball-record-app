-- Add current_pitch_log to game_input_sessions for realtime pitch count display
alter table public.game_input_sessions
  add column current_pitch_log jsonb not null default '[]';
