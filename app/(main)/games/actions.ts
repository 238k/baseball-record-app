"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPitchingStatsDelta } from "./pitching-stats";

interface LineupEntry {
  battingOrder: number;
  playerId: string | null;
  playerName: string | null;
  position: string | null;
}

interface DhPitcher {
  playerId: string | null;
  playerName: string;
}

interface SaveLineupInput {
  gameId: string;
  homeLineup: LineupEntry[];
  visitorLineup: LineupEntry[];
  homePitcherOrder: number;
  visitorPitcherOrder: number;
  homeDhPitcher?: DhPitcher;
  visitorDhPitcher?: DhPitcher;
}

export async function createGameAction(input: {
  teamId: string;
  opponentName: string;
  gameDate: string;
  location: string;
  isHome: boolean;
  innings: number;
  useDh: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  const opponentName = input.opponentName.trim();
  if (!opponentName) return { error: "相手チーム名を入力してください" };
  if (!input.gameDate) return { error: "試合日を入力してください" };

  const { data: game, error: insertError } = await supabase
    .from("games")
    .insert({
      team_id: input.teamId,
      opponent_name: opponentName,
      game_date: input.gameDate,
      location: input.location.trim() || null,
      is_home: input.isHome,
      innings: input.innings,
      use_dh: input.useDh,
    })
    .select("id")
    .single();

  if (insertError || !game) {
    console.error("createGame error:", insertError);
    return { error: "試合の作成に失敗しました" };
  }

  revalidatePath("/");
  return { gameId: game.id };
}

export async function saveLineupAction(input: SaveLineupInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Validation
  for (const [label, lineup] of [
    ["ホーム", input.homeLineup],
    ["ビジター", input.visitorLineup],
  ] as const) {
    const missing = lineup.filter((e) => !e.playerId && !e.playerName);
    if (missing.length > 0) {
      const orders = missing.map((e) => e.battingOrder).join(", ");
      return { error: `${label}の ${orders} 番打者が未設定です` };
    }
  }

  // Delete existing lineups and pitching_records for this game
  await supabase
    .from("pitching_records")
    .delete()
    .eq("game_id", input.gameId);
  await supabase.from("lineups").delete().eq("game_id", input.gameId);

  // Build lineup rows
  const rows = [
    ...input.homeLineup.map((e) => ({
      game_id: input.gameId,
      team_side: "home" as const,
      batting_order: e.battingOrder,
      player_id: e.playerId,
      player_name: e.playerName,
      position: e.position,
    })),
    ...input.visitorLineup.map((e) => ({
      game_id: input.gameId,
      team_side: "visitor" as const,
      batting_order: e.battingOrder,
      player_id: e.playerId,
      player_name: e.playerName,
      position: e.position,
    })),
  ];

  const { data: insertedLineups, error: lineupError } = await supabase
    .from("lineups")
    .insert(rows)
    .select("id, team_side, batting_order");

  if (lineupError || !insertedLineups) {
    console.error("saveLineup error:", lineupError);
    const detail = lineupError?.message ?? "不明なエラー";
    return { error: `オーダーの保存に失敗しました: ${detail}` };
  }

  // Create pitcher lineup entries for DH mode and pitching_records
  const pitchingRows: { game_id: string; lineup_id: string; inning_from: number }[] = [];

  for (const side of ["home", "visitor"] as const) {
    const dhPitcher = side === "home" ? input.homeDhPitcher : input.visitorDhPitcher;
    const pitcherOrder = side === "home" ? input.homePitcherOrder : input.visitorPitcherOrder;

    if (dhPitcher) {
      // DH mode: insert a separate pitcher lineup entry
      const { data: pitcherLineup, error: pitcherError } = await supabase
        .from("lineups")
        .insert({
          game_id: input.gameId,
          team_side: side,
          batting_order: pitcherOrder,
          player_id: dhPitcher.playerId,
          player_name: dhPitcher.playerName,
          position: "投",
        })
        .select("id")
        .single();

      if (pitcherError || !pitcherLineup) {
        console.error("DH pitcher lineup insert error:", pitcherError);
        const sideLabel = side === "home" ? "ホーム" : "ビジター";
        return { error: `${sideLabel}の投手登録に失敗しました: ${pitcherError?.message ?? "不明なエラー"}` };
      } else {
        pitchingRows.push({
          game_id: input.gameId,
          lineup_id: pitcherLineup.id,
          inning_from: 1,
        });
      }
    } else {
      // Normal mode: find the 投 entry by batting_order
      const pitcher = insertedLineups.find(
        (l) => l.team_side === side && l.batting_order === pitcherOrder
      );
      if (pitcher) {
        pitchingRows.push({
          game_id: input.gameId,
          lineup_id: pitcher.id,
          inning_from: 1,
        });
      }
    }
  }

  if (pitchingRows.length > 0) {
    const { error: pitchError } = await supabase
      .from("pitching_records")
      .insert(pitchingRows);

    if (pitchError) {
      console.error("pitching_records insert error:", pitchError);
      // Non-fatal: lineup is saved, pitching records can be re-created
    }
  }

  revalidatePath(`/games/${input.gameId}`);
  revalidatePath(`/games/${input.gameId}/lineup`);
  return { ok: true };
}

export async function updateGameDhAction(gameId: string, useDh: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  const { error } = await supabase
    .from("games")
    .update({ use_dh: useDh })
    .eq("id", gameId);

  if (error) {
    console.error("updateGameDh error:", error);
    return { error: "DH制の変更に失敗しました" };
  }

  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/games/${gameId}/lineup`);
  return { ok: true };
}

// ---- At-bat recording ----

interface RunnerDestination {
  lineupId: string;
  event: "scored" | "out" | "stay";
  toBase?: "1st" | "2nd" | "3rd";
}

interface RecordAtBatInput {
  gameId: string;
  inning: number;
  inningHalf: "top" | "bottom";
  battingOrder: number;
  lineupId: string;
  result: string;
  rbi: number;
  pitchCount: number;
  pitches: ("ball" | "swinging" | "looking" | "foul")[];
  // Runners on base at start of at-bat (snapshot)
  baseRunnersBefore: { base: string; lineupId: string }[];
  // What happened to each runner + batter
  runnerDestinations: RunnerDestination[];
}

export async function recordAtBatAction(input: RecordAtBatInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // 1. Insert at_bat
  const { data: atBat, error: abError } = await supabase
    .from("at_bats")
    .insert({
      game_id: input.gameId,
      inning: input.inning,
      inning_half: input.inningHalf,
      batting_order: input.battingOrder,
      lineup_id: input.lineupId,
      result: input.result,
      rbi: input.rbi,
      pitch_count: input.pitchCount,
      recorded_by: user.id,
    })
    .select("id")
    .single();

  if (abError || !atBat) {
    console.error("recordAtBat error:", abError);
    return { error: "打席の記録に失敗しました" };
  }

  // 2. Insert base_runners snapshot (runners on base at start of at-bat)
  if (input.baseRunnersBefore.length > 0) {
    const { error: brError } = await supabase.from("base_runners").insert(
      input.baseRunnersBefore.map((br) => ({
        game_id: input.gameId,
        at_bat_id: atBat.id,
        base: br.base,
        lineup_id: br.lineupId,
      }))
    );
    if (brError) {
      console.error("base_runners insert error:", brError);
    }
  }

  // 3. Insert runner_events (scored / out)
  const events = input.runnerDestinations.filter(
    (d) => d.event === "scored" || d.event === "out"
  );
  if (events.length > 0) {
    const { error: reError } = await supabase.from("runner_events").insert(
      events.map((e) => ({
        at_bat_id: atBat.id,
        lineup_id: e.lineupId,
        event_type: e.event,
      }))
    );
    if (reError) {
      console.error("runner_events insert error:", reError);
    }
  }

  // 4. Insert pitches
  if (input.pitches.length > 0) {
    const { error: pitchError } = await supabase.from("pitches").insert(
      input.pitches.map((result, i) => ({
        at_bat_id: atBat.id,
        pitch_number: i + 1,
        result,
      }))
    );
    if (pitchError) {
      console.error("pitches insert error:", pitchError);
    }
  }

  // 5. Update pitching_records for the fielding team's active pitcher
  const delta = getPitchingStatsDelta(input.result, input.runnerDestinations);
  const hasDelta =
    delta.outs > 0 ||
    delta.hits > 0 ||
    delta.runs > 0 ||
    delta.walks > 0 ||
    delta.strikeouts > 0;

  if (hasDelta) {
    const fieldingSide = input.inningHalf === "top" ? "home" : "visitor";

    // Find active pitcher record for the fielding side
    const { data: openRecords } = await supabase
      .from("pitching_records")
      .select("id, lineup_id, outs_recorded, hits, runs, earned_runs, walks, strikeouts")
      .eq("game_id", input.gameId)
      .is("inning_to", null);

    if (openRecords && openRecords.length > 0) {
      // Get fielding team's lineup IDs
      const { data: fieldingLineups } = await supabase
        .from("lineups")
        .select("id")
        .eq("game_id", input.gameId)
        .eq("team_side", fieldingSide);

      const fieldingIds = new Set((fieldingLineups ?? []).map((l) => l.id));
      const pitcherRecord = openRecords.find((r) => fieldingIds.has(r.lineup_id));

      if (pitcherRecord) {
        const { error: updateError } = await supabase
          .from("pitching_records")
          .update({
            outs_recorded: pitcherRecord.outs_recorded + delta.outs,
            hits: pitcherRecord.hits + delta.hits,
            runs: pitcherRecord.runs + delta.runs,
            earned_runs: pitcherRecord.earned_runs + delta.earnedRuns,
            walks: pitcherRecord.walks + delta.walks,
            strikeouts: pitcherRecord.strikeouts + delta.strikeouts,
          })
          .eq("id", pitcherRecord.id);

        if (updateError) {
          console.error("pitching_records update error:", updateError);
        }
      }
    }
  }

  revalidatePath(`/games/${input.gameId}`);
  return { ok: true };
}

export async function changePitcherAction(input: {
  gameId: string;
  currentInning: number;
  newPitcherLineupId: string;
  fieldingTeamSide: "home" | "visitor";
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Close current pitcher's record
  const { data: currentRecord } = await supabase
    .from("pitching_records")
    .select("id, lineup_id")
    .eq("game_id", input.gameId)
    .is("inning_to", null)
    .limit(10);

  // Find the record for the fielding team's current pitcher
  if (currentRecord && currentRecord.length > 0) {
    // Get the fielding team's lineups to match
    const { data: fieldingLineups } = await supabase
      .from("lineups")
      .select("id")
      .eq("game_id", input.gameId)
      .eq("team_side", input.fieldingTeamSide);

    const fieldingIds = new Set((fieldingLineups ?? []).map((l) => l.id));
    const pitcherRecord = currentRecord.find((r) => fieldingIds.has(r.lineup_id));

    if (pitcherRecord) {
      await supabase
        .from("pitching_records")
        .update({ inning_to: input.currentInning })
        .eq("id", pitcherRecord.id);
    }
  }

  // Create new pitcher record
  const { error: newError } = await supabase.from("pitching_records").insert({
    game_id: input.gameId,
    lineup_id: input.newPitcherLineupId,
    inning_from: input.currentInning,
  });

  if (newError) {
    console.error("changePitcher error:", newError);
    return { error: "投手交代に失敗しました" };
  }

  revalidatePath(`/games/${input.gameId}`);
  return { ok: true };
}

// ---- Steal recording ----

export async function recordStealAction(input: {
  gameId: string;
  lineupId: string;
  eventType: "stolen_base" | "caught_stealing";
  fromBase: "1st" | "2nd" | "3rd";
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Find the most recent at-bat for this game (runner_events.at_bat_id is NOT NULL)
  const { data: lastAtBat } = await supabase
    .from("at_bats")
    .select("id")
    .eq("game_id", input.gameId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!lastAtBat) {
    return { error: "打席が記録されていないため盗塁を記録できません" };
  }

  // Insert stolen_base or caught_stealing event
  const { error: reError } = await supabase.from("runner_events").insert({
    at_bat_id: lastAtBat.id,
    lineup_id: input.lineupId,
    event_type: input.eventType,
  });

  if (reError) {
    console.error("recordSteal error:", reError);
    return { error: "盗塁の記録に失敗しました" };
  }

  // Home steal success: also record a scored event
  if (input.eventType === "stolen_base" && input.fromBase === "3rd") {
    const { error: scoredError } = await supabase.from("runner_events").insert({
      at_bat_id: lastAtBat.id,
      lineup_id: input.lineupId,
      event_type: "scored",
    });

    if (scoredError) {
      console.error("home steal scored error:", scoredError);
    }
  }

  revalidatePath(`/games/${input.gameId}`);
  return { ok: true };
}

export async function finishGameAction(gameId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Close all open pitching records
  const { data: openRecords } = await supabase
    .from("pitching_records")
    .select("id")
    .eq("game_id", gameId)
    .is("inning_to", null);

  if (openRecords && openRecords.length > 0) {
    // Get current inning from the last at-bat
    const { data: lastAb } = await supabase
      .from("at_bats")
      .select("inning")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const finalInning = lastAb?.inning ?? 9;

    for (const record of openRecords) {
      await supabase
        .from("pitching_records")
        .update({ inning_to: finalInning })
        .eq("id", record.id);
    }
  }

  const { error } = await supabase
    .from("games")
    .update({ status: "finished" })
    .eq("id", gameId);

  if (error) {
    console.error("finishGame error:", error);
    return { error: "試合の終了に失敗しました" };
  }

  revalidatePath("/");
  revalidatePath(`/games/${gameId}`);
  return { ok: true };
}

export async function startGameAction(gameId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  const { error } = await supabase
    .from("games")
    .update({ status: "in_progress" })
    .eq("id", gameId);

  if (error) {
    console.error("startGame error:", error);
    return { error: "試合の開始に失敗しました" };
  }

  revalidatePath("/");
  revalidatePath(`/games/${gameId}`);
  return { ok: true };
}
