-- Fix SECURITY DEFINER views to use SECURITY INVOKER
-- SECURITY DEFINER views bypass RLS policies of the querying user,
-- instead using the view owner's permissions. This is a security risk.
-- SECURITY INVOKER ensures RLS policies are enforced for the actual user.

alter view v_batter_game_stats set (security_invoker = true);
alter view v_batter_career_stats set (security_invoker = true);
alter view v_pitcher_game_stats set (security_invoker = true);
alter view v_pitcher_career_stats set (security_invoker = true);
alter view v_scoreboard set (security_invoker = true);
