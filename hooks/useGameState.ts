"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ---- Types ----

export interface LineupPlayer {
  id: string;
  batting_order: number;
  player_id: string | null;
  player_name: string | null;
  position: string | null;
  team_side: string;
}

export interface BaseRunners {
  first: LineupPlayer | null;
  second: LineupPlayer | null;
  third: LineupPlayer | null;
}

export interface GameInfo {
  id: string;
  team_id: string;
  opponent_name: string;
  is_home: boolean;
  status: string;
  innings: number;
  use_dh: boolean;
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

const OUT_RESULTS = new Set(["K", "KK", "GO", "FO", "LO", "SF", "SH"]);
const DOUBLE_PLAY_RESULTS = new Set(["DP"]);

function getOutsForResult(result: string, runnerEvents: RunnerEventRow[]): number {
  if (DOUBLE_PLAY_RESULTS.has(result)) return 2;
  if (OUT_RESULTS.has(result)) return 1;
  // FC, E can produce outs via runner_events
  const outEvents = runnerEvents.filter((e) => e.event_type === "out");
  // For results like FC, batter is safe but a runner may be out
  if (result === "FC") return outEvents.length;
  return outEvents.length;
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

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = createClient();

      // Fetch game
      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("id, team_id, opponent_name, is_home, status, innings, use_dh")
        .eq("id", gameId)
        .single();

      if (gameError || !game) {
        setState((prev) => ({ ...prev, loading: false, error: "試合データの取得に失敗しました" }));
        return;
      }

      // Fetch team name
      const { data: team } = await supabase
        .from("teams")
        .select("name")
        .eq("id", game.team_id)
        .single();

      // Fetch lineups (batting lineup only, exclude DH pitchers)
      const { data: lineups } = await supabase
        .from("lineups")
        .select("id, batting_order, player_id, player_name, position, team_side")
        .eq("game_id", gameId)
        .order("batting_order");

      const allLineups: LineupPlayer[] = lineups ?? [];

      // Fetch all at_bats for this game
      const { data: atBats } = await supabase
        .from("at_bats")
        .select("id, inning, inning_half, batting_order, lineup_id, result, rbi")
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

      for (const ab of completedAtBats) {
        // If this at-bat is in a different half-inning, update tracking
        const halfKey = `${ab.inning}-${ab.inning_half}`;

        if (ab.inning !== currentInning || ab.inning_half !== currentHalf) {
          // New half-inning started
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

        // Calculate outs from this at-bat
        const outsFromAb = getOutsForResult(ab.result, events);
        outs += outsFromAb;

        // Track last batter order in this half-inning
        lastBatterOrder[halfKey] = ab.batting_order;

        // If 3 outs, the inning half ends (runners and outs reset will happen for next half)
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
          // Reconstruct runners after this at-bat from events
          // The next at-bat's base_runners snapshot will be the "after" state
          // For the final state, we need to compute from the last at-bat's result
          runners = computeRunnersAfterAtBat(ab, runners, events, allLineups);
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

      setState({
        game,
        myTeamName: team?.name ?? "自チーム",
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

  return { ...state, reload };
}

// ---- Helpers ----

function computeRunnersAfterAtBat(
  ab: AtBatRow & { result: string },
  runnersBefore: BaseRunners,
  events: RunnerEventRow[],
  lineups: LineupPlayer[]
): BaseRunners {
  const result = ab.result;
  const after: BaseRunners = { first: null, second: null, third: null };

  // Get scored/out lineup IDs
  const scoredIds = new Set(events.filter((e) => e.event_type === "scored").map((e) => e.lineup_id));
  const outIds = new Set(events.filter((e) => e.event_type === "out").map((e) => e.lineup_id));

  const batter = lineups.find((l) => l.id === ab.lineup_id) ?? null;
  const removedIds = new Set([...scoredIds, ...outIds]);

  // Runners who stayed or advanced (not scored, not out)
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

  // Use default advancement logic based on result type
  switch (result) {
    case "HR":
      // Everyone scores (handled by events), bases empty
      break;
    case "3B":
      if (batter && !scoredIds.has(batter.id)) after.third = batter;
      break;
    case "2B":
      if (batter && !scoredIds.has(batter.id)) after.second = batter;
      // Remaining runners advance
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
      // Walk/HBP: batter to 1st, push runners only if forced
      if (batter) after.first = batter;
      if (runnersBefore.first && !removedIds.has(runnersBefore.first.id)) {
        after.second = runnersBefore.first;
        if (runnersBefore.second && !removedIds.has(runnersBefore.second.id)) {
          after.third = runnersBefore.second;
        } else {
          // Keep 2nd base runner in place if any (and first didn't push)
        }
      }
      // If 2nd was occupied and 1st wasn't, 2nd stays
      if (!after.second && runnersBefore.second && !removedIds.has(runnersBefore.second.id)) {
        after.second = runnersBefore.second;
      }
      if (!after.third && runnersBefore.third && !removedIds.has(runnersBefore.third.id)) {
        after.third = runnersBefore.third;
      }
      break;
    case "SH":
      // Batter is out, runners advance one base
      for (const r of remainingRunners) {
        if (r.fromBase === "2nd" && !after.third) after.third = r.player;
        else if (r.fromBase === "1st" && !after.second) after.second = r.player;
      }
      break;
    case "SF":
      // Batter out, 3rd runner scores (handled), others stay
      for (const r of remainingRunners) {
        if (r.fromBase === "2nd") after.second = r.player;
        else if (r.fromBase === "1st") after.first = r.player;
      }
      break;
    default:
      // GO, FO, LO, K, KK, DP — batter is out, runners generally stay
      for (const r of remainingRunners) {
        if (r.fromBase === "3rd" && !after.third) after.third = r.player;
        else if (r.fromBase === "2nd" && !after.second) after.second = r.player;
        else if (r.fromBase === "1st" && !after.first) after.first = r.player;
      }
      break;
  }

  return after;
}
