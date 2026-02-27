"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ---- Types ----

export interface LineupPlayer {
  id: string;
  batting_order: number;
  player_id: string | null;
  player_name: string | null;
  player_number: string | null;
  position: string | null;
  team_side: string;
  inning_from: number;
}

export interface BaseRunners {
  first: LineupPlayer | null;
  second: LineupPlayer | null;
  third: LineupPlayer | null;
}

export interface GameInfo {
  id: string;
  team_id: string | null;
  opponent_name: string;
  is_home: boolean;
  status: string;
  innings: number;
  use_dh: boolean;
  game_date: string;
  location: string | null;
  is_free_mode: boolean;
  home_team_name: string | null;
  visitor_team_name: string | null;
  created_by: string;
}

export interface GameState {
  game: GameInfo | null;
  myTeamName: string;
  lineups: LineupPlayer[];
  currentInning: number;
  currentHalf: "top" | "bottom";
  currentOuts: number;
  currentBatterOrder: number;
  baseRunners: BaseRunners;
  score: { home: number; visitor: number };
  loading: boolean;
  error: string | null;
}

interface AtBatRow {
  id: string;
  inning: number;
  inning_half: string;
  batting_order: number;
  lineup_id: string;
  result: string | null;
  rbi: number;
  runners_after: { base: string; lineup_id: string }[] | null;
}

interface RunnerEventRow {
  at_bat_id: string;
  lineup_id: string;
  event_type: string;
}

interface BaseRunnerRow {
  at_bat_id: string;
  base: string;
  lineup_id: string;
}

// ---- Constants ----

function getOutsForResult(_result: string, runnerEvents: RunnerEventRow[]): number {
  // Count outs from actual runner_events data (includes batter out events and caught stealing)
  return runnerEvents.filter((e) => e.event_type === "out" || e.event_type === "caught_stealing").length;
}

// ---- Hook ----

export function useGameState(gameId: string) {
  const [state, setState] = useState<GameState>({
    game: null,
    myTeamName: "自チーム",
    lineups: [],
    currentInning: 1,
    currentHalf: "top",
    currentOuts: 0,
    currentBatterOrder: 1,
    baseRunners: { first: null, second: null, third: null },
    score: { home: 0, visitor: 0 },
    loading: true,
    error: null,
  });

  const reload = useCallback(async (silent?: boolean) => {
    if (!silent) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    try {
      const supabase = createClient();

      // Fetch game
      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("id, team_id, opponent_name, is_home, status, innings, use_dh, game_date, location, is_free_mode, home_team_name, visitor_team_name, created_by")
        .eq("id", gameId)
        .single();

      if (gameError || !game) {
        setState((prev) => ({ ...prev, loading: false, error: "試合データの取得に失敗しました" }));
        return;
      }

      // Fetch team name (skip for free mode)
      let team: { name: string } | null = null;
      if (!game.is_free_mode && game.team_id) {
        const { data } = await supabase
          .from("teams")
          .select("name")
          .eq("id", game.team_id)
          .single();
        team = data;
      }

      // Fetch lineups (batting lineup only, exclude DH pitchers)
      const { data: lineups } = await supabase
        .from("lineups")
        .select("id, batting_order, player_id, player_name, position, team_side, inning_from, players(number)")
        .eq("game_id", gameId)
        .order("batting_order")
        .order("inning_from")
        .order("created_at");

      const allLineups: LineupPlayer[] = (lineups ?? []).map((l) => ({
        id: l.id,
        batting_order: l.batting_order,
        player_id: l.player_id,
        player_name: l.player_name,
        player_number: (l.players as { number: string | null } | null)?.number ?? null,
        position: l.position,
        team_side: l.team_side,
        inning_from: l.inning_from,
      }));

      // Fetch all at_bats for this game
      const { data: atBats } = await supabase
        .from("at_bats")
        .select("id, inning, inning_half, batting_order, lineup_id, result, rbi, runners_after")
        .eq("game_id", gameId)
        .order("created_at", { ascending: true });

      // runner_events doesn't have game_id — fetch by at_bat_ids
      const atBatIds = (atBats ?? []).map((ab) => ab.id);
      let allRunnerEvents: RunnerEventRow[] = [];
      if (atBatIds.length > 0) {
        const { data: reData } = await supabase
          .from("runner_events")
          .select("at_bat_id, lineup_id, event_type")
          .in("at_bat_id", atBatIds);
        allRunnerEvents = reData ?? [];
      }

      // Fetch base_runners snapshots
      let allBaseRunners: BaseRunnerRow[] = [];
      if (atBatIds.length > 0) {
        const { data: brData } = await supabase
          .from("base_runners")
          .select("at_bat_id, base, lineup_id")
          .in("at_bat_id", atBatIds);
        allBaseRunners = brData ?? [];
      }

      // ---- Reconstruct state ----
      const completedAtBats = (atBats ?? []).filter((ab) => ab.result != null) as (AtBatRow & { result: string })[];

      let currentInning = 1;
      let currentHalf: "top" | "bottom" = "top";
      let outs = 0;
      let runners: BaseRunners = { first: null, second: null, third: null };
      let scoreHome = 0;
      let scoreVisitor = 0;
      // Track batting order per half-inning side
      const lastBatterOrder: Record<string, number> = {};

      const findLineup = (lineupId: string) =>
        allLineups.find((l) => l.id === lineupId) ?? null;

      for (let i = 0; i < completedAtBats.length; i++) {
        const ab = completedAtBats[i];
        const halfKey = `${ab.inning}-${ab.inning_half}`;

        if (ab.inning !== currentInning || ab.inning_half !== currentHalf) {
          currentInning = ab.inning;
          currentHalf = ab.inning_half as "top" | "bottom";
          outs = 0;
          runners = { first: null, second: null, third: null };
        }

        // Restore runners from base_runners snapshot for this at-bat
        const snapshot = allBaseRunners.filter((br) => br.at_bat_id === ab.id);
        runners = { first: null, second: null, third: null };
        for (const br of snapshot) {
          if (br.base === "1st") runners.first = findLineup(br.lineup_id);
          if (br.base === "2nd") runners.second = findLineup(br.lineup_id);
          if (br.base === "3rd") runners.third = findLineup(br.lineup_id);
        }

        // Process runner events
        const events = allRunnerEvents.filter((re) => re.at_bat_id === ab.id);
        const scoredCount = events.filter((e) => e.event_type === "scored").length;

        if (ab.inning_half === "top") {
          scoreVisitor += scoredCount;
        } else {
          scoreHome += scoredCount;
        }

        // Calculate outs from actual runner_events
        const outsFromAb = getOutsForResult(ab.result, events);
        outs += outsFromAb;

        lastBatterOrder[halfKey] = ab.batting_order;

        if (outs >= 3) {
          outs = 0;
          runners = { first: null, second: null, third: null };
          if (currentHalf === "top") {
            currentHalf = "bottom";
          } else {
            currentInning += 1;
            currentHalf = "top";
          }
        } else {
          // Use next at-bat's snapshot if available (accurate)
          const nextAb = completedAtBats[i + 1];
          if (nextAb) {
            const nextSnapshot = allBaseRunners.filter((br) => br.at_bat_id === nextAb.id);
            runners = computeRunnersAfterAtBat(ab, runners, events, allLineups, nextSnapshot);
          } else if (ab.runners_after) {
            // Last at-bat: use stored runners_after (user-selected positions)
            runners = { first: null, second: null, third: null };
            for (const ra of ab.runners_after) {
              const player = findLineup(ra.lineup_id);
              if (ra.base === "1st") runners.first = player;
              else if (ra.base === "2nd") runners.second = player;
              else if (ra.base === "3rd") runners.third = player;
            }
            // Apply steal events that occurred after the at-bat result
            applyRunnerEvents(runners, events);
          } else {
            // Fallback: infer from result code (for old at-bats without runners_after)
            runners = computeRunnersAfterAtBat(ab, runners, events, allLineups, null);
          }
        }
      }

      // Determine current batting team side
      const battingTeamSide = currentHalf === "top" ? "visitor" : "home";

      // Determine next batter order
      const currentHalfKey = `${currentInning}-${currentHalf}`;
      // Look up the last batter in this specific half-inning
      let nextBatterOrder: number;
      if (lastBatterOrder[currentHalfKey] != null) {
        nextBatterOrder = (lastBatterOrder[currentHalfKey] % 9) + 1;
      } else {
        // No at-bats in this half-inning yet. Check for last batter on this side
        // across all previous half-innings of same side
        const sameTeamAtBats = completedAtBats.filter(
          (ab) =>
            (ab.inning_half === "top" && battingTeamSide === "visitor") ||
            (ab.inning_half === "bottom" && battingTeamSide === "home")
        );
        if (sameTeamAtBats.length > 0) {
          const lastAb = sameTeamAtBats[sameTeamAtBats.length - 1];
          nextBatterOrder = (lastAb.batting_order % 9) + 1;
        } else {
          nextBatterOrder = 1;
        }
      }

      const myTeamName = game.is_free_mode
        ? (game.home_team_name ?? "ホーム")
        : (team?.name ?? "自チーム");

      setState({
        game,
        myTeamName,
        lineups: allLineups,
        currentInning,
        currentHalf,
        currentOuts: outs,
        currentBatterOrder: nextBatterOrder,
        baseRunners: runners,
        score: { home: scoreHome, visitor: scoreVisitor },
        loading: false,
        error: null,
      });
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "データの読み込みに失敗しました",
      }));
    }
  }, [gameId]);

  // Initial load
  // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
  useEffect(() => { reload(); }, [reload]);

  const optimisticUpdate = useCallback((partial: Partial<GameState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  return { ...state, reload, optimisticUpdate };
}

// ---- Helpers ----

/**
 * Apply stolen_base / caught_stealing / wild_pitch / passed_ball / balk events
 * on top of current runner positions.
 * These events are recorded between at-bats but attached to the previous at-bat.
 */
function applyRunnerEvents(runners: BaseRunners, events: RunnerEventRow[]): void {
  // Remove caught-stealing runners
  const caughtIds = new Set(events.filter((e) => e.event_type === "caught_stealing").map((e) => e.lineup_id));
  for (const csId of caughtIds) {
    if (runners.first?.id === csId) runners.first = null;
    if (runners.second?.id === csId) runners.second = null;
    if (runners.third?.id === csId) runners.third = null;
  }

  // Advance runners: stolen_base / wild_pitch / passed_ball / balk
  const advanceTypes = new Set(["stolen_base", "wild_pitch", "passed_ball", "balk"]);
  const advanceIds = new Set(
    events.filter((e) => advanceTypes.has(e.event_type)).map((e) => e.lineup_id)
  );
  // Also check if scored (runner reached home via WP/PB/BK)
  const scoredIds = new Set(events.filter((e) => e.event_type === "scored").map((e) => e.lineup_id));

  for (const advId of advanceIds) {
    if (runners.third?.id === advId) {
      // 3rd → home (scored event handles removal)
      runners.third = null;
    } else if (runners.second?.id === advId) {
      if (scoredIds.has(advId)) {
        // Scored directly from 2nd (e.g., double advance on WP)
        runners.second = null;
      } else if (!runners.third) {
        runners.third = runners.second;
        runners.second = null;
      }
    } else if (runners.first?.id === advId) {
      if (scoredIds.has(advId)) {
        runners.first = null;
      } else if (!runners.second) {
        runners.second = runners.first;
        runners.first = null;
      }
    }
  }
}

/**
 * Compute runners after an at-bat using the NEXT at-bat's base_runners snapshot
 * when available (most accurate), falling back to inference for the very last at-bat.
 */
function computeRunnersAfterAtBat(
  ab: AtBatRow & { result: string },
  runnersBefore: BaseRunners,
  events: RunnerEventRow[],
  lineups: LineupPlayer[],
  nextAtBatSnapshot: BaseRunnerRow[] | null
): BaseRunners {
  // If we have the next at-bat's snapshot, use it (most accurate)
  if (nextAtBatSnapshot !== null) {
    const findLineup = (lineupId: string) =>
      lineups.find((l) => l.id === lineupId) ?? null;
    const after: BaseRunners = { first: null, second: null, third: null };
    for (const br of nextAtBatSnapshot) {
      if (br.base === "1st") after.first = findLineup(br.lineup_id);
      if (br.base === "2nd") after.second = findLineup(br.lineup_id);
      if (br.base === "3rd") after.third = findLineup(br.lineup_id);
    }
    return after;
  }

  // Last at-bat: infer from result code and events
  const result = ab.result;
  const after: BaseRunners = { first: null, second: null, third: null };

  const scoredIds = new Set(events.filter((e) => e.event_type === "scored").map((e) => e.lineup_id));
  const outIds = new Set(events.filter((e) => e.event_type === "out" || e.event_type === "caught_stealing").map((e) => e.lineup_id));
  const removedIds = new Set([...scoredIds, ...outIds]);

  const batter = lineups.find((l) => l.id === ab.lineup_id) ?? null;

  const remainingRunners: { player: LineupPlayer; fromBase: string }[] = [];
  if (runnersBefore.third && !removedIds.has(runnersBefore.third.id)) {
    remainingRunners.push({ player: runnersBefore.third, fromBase: "3rd" });
  }
  if (runnersBefore.second && !removedIds.has(runnersBefore.second.id)) {
    remainingRunners.push({ player: runnersBefore.second, fromBase: "2nd" });
  }
  if (runnersBefore.first && !removedIds.has(runnersBefore.first.id)) {
    remainingRunners.push({ player: runnersBefore.first, fromBase: "1st" });
  }

  switch (result) {
    case "HR":
      break;
    case "3B":
      if (batter && !scoredIds.has(batter.id)) after.third = batter;
      break;
    case "2B":
      if (batter && !scoredIds.has(batter.id)) after.second = batter;
      for (const r of remainingRunners) {
        if (r.fromBase === "1st" && !after.third) after.third = r.player;
      }
      break;
    case "1B":
    case "E":
    case "FC":
      if (batter && !scoredIds.has(batter.id) && !outIds.has(batter.id)) after.first = batter;
      for (const r of remainingRunners) {
        if (r.fromBase === "2nd" && !after.third) after.third = r.player;
        else if (r.fromBase === "1st" && !after.second) after.second = r.player;
      }
      break;
    case "BB":
    case "IBB":
    case "HBP":
      if (batter) after.first = batter;
      if (runnersBefore.first && !removedIds.has(runnersBefore.first.id)) {
        after.second = runnersBefore.first;
        if (runnersBefore.second && !removedIds.has(runnersBefore.second.id)) {
          after.third = runnersBefore.second;
        }
      }
      if (!after.second && runnersBefore.second && !removedIds.has(runnersBefore.second.id)) {
        after.second = runnersBefore.second;
      }
      if (!after.third && runnersBefore.third && !removedIds.has(runnersBefore.third.id)) {
        after.third = runnersBefore.third;
      }
      break;
    case "SH":
      for (const r of remainingRunners) {
        if (r.fromBase === "2nd" && !after.third) after.third = r.player;
        else if (r.fromBase === "1st" && !after.second) after.second = r.player;
      }
      break;
    case "SF":
      for (const r of remainingRunners) {
        if (r.fromBase === "2nd") after.second = r.player;
        else if (r.fromBase === "1st") after.first = r.player;
      }
      break;
    default:
      for (const r of remainingRunners) {
        if (r.fromBase === "3rd" && !after.third) after.third = r.player;
        else if (r.fromBase === "2nd" && !after.second) after.second = r.player;
        else if (r.fromBase === "1st" && !after.first) after.first = r.player;
      }
      break;
  }

  // Apply stolen_base events: advance runners who stole successfully
  const stolenBaseIds = new Set(events.filter((e) => e.event_type === "stolen_base").map((e) => e.lineup_id));
  for (const stealId of stolenBaseIds) {
    // Find which base this runner is on and advance them (only if destination is empty)
    if (after.first && after.first.id === stealId) {
      if (!after.second) {
        after.second = after.first;
        after.first = null;
      }
    } else if (after.second && after.second.id === stealId) {
      if (!after.third) {
        after.third = after.second;
        after.second = null;
      }
    }
    // 3rd → home is handled by scored event (already removed from bases)
  }

  return after;
}
