"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPitchingStatsDelta } from "./pitching-stats";
import {
  createGameSchema,
  updateGameSchema,
  saveLineupSchema,
  recordAtBatSchema,
  changePitcherSchema,
  recordStealSchema,
  substitutePlayerSchema,
  changePositionSchema,
  recordRunnerAdvanceSchema,
  parseOrError,
} from "./validation";

export async function createGameAction(input: {
  teamId: string;
  opponentName: string;
  gameDate: string;
  location: string;
  isHome: boolean;
  innings: number;
  useDh: boolean;
}) {
  const parsed = parseOrError(createGameSchema, input);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  const opponentName = input.opponentName.trim();
  if (!opponentName) return { error: "相手チーム名を入力してください" };

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

export async function saveLineupAction(input: {
  gameId: string;
  homeLineup: { battingOrder: number; playerId: string | null; playerName: string | null; position: string | null }[];
  visitorLineup: { battingOrder: number; playerId: string | null; playerName: string | null; position: string | null }[];
  homePitcherOrder: number;
  visitorPitcherOrder: number;
  homeDhPitcher?: { playerId: string | null; playerName: string };
  visitorDhPitcher?: { playerId: string | null; playerName: string };
}) {
  const parsed = parseOrError(saveLineupSchema, input);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Check game status
  const { data: game } = await supabase
    .from("games")
    .select("status")
    .eq("id", input.gameId)
    .single();

  if (game && game.status !== "scheduled") {
    return { error: "試合前の試合のみオーダーを変更できます" };
  }

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

export async function recordAtBatAction(input: {
  gameId: string;
  inning: number;
  inningHalf: "top" | "bottom";
  battingOrder: number;
  lineupId: string;
  result: string;
  rbi: number;
  pitchCount: number;
  pitches: ("ball" | "swinging" | "looking" | "foul")[];
  baseRunnersBefore: { base: string; lineupId: string }[];
  runnerDestinations: { lineupId: string; event: "scored" | "out" | "stay"; toBase?: "1st" | "2nd" | "3rd" }[];
  runnersAfter?: { base: string; lineupId: string }[];
}) {
  const parsed = parseOrError(recordAtBatSchema, input);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Check game status
  const { data: game } = await supabase
    .from("games")
    .select("status")
    .eq("id", input.gameId)
    .single();

  if (!game || game.status !== "in_progress") {
    return { error: "試合が進行中ではありません" };
  }

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
      runners_after: input.runnersAfter?.map((r) => ({ base: r.base, lineup_id: r.lineupId })) ?? null,
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
  const parsed = parseOrError(changePitcherSchema, input);
  if (parsed.error) return { error: parsed.error };

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
  const parsed = parseOrError(recordStealSchema, input);
  if (parsed.error) return { error: parsed.error };

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

// ---- Player substitution ----

export async function substitutePlayerAction(input: {
  gameId: string;
  battingOrder: number;
  teamSide: "home" | "visitor";
  newPlayerId: string | null;
  newPlayerName: string;
  newPosition: string;
  currentInning: number;
  type: "pinch_hitter" | "pinch_runner";
  replacedLineupId?: string;
}) {
  const parsed = parseOrError(substitutePlayerSchema, input);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Insert new lineup entry
  const { data: newLineup, error: insertError } = await supabase
    .from("lineups")
    .insert({
      game_id: input.gameId,
      team_side: input.teamSide,
      batting_order: input.battingOrder,
      player_id: input.newPlayerId,
      player_name: input.newPlayerName.trim(),
      position: input.newPosition,
      inning_from: input.currentInning,
    })
    .select("id")
    .single();

  if (insertError || !newLineup) {
    console.error("substitutePlayer error:", insertError);
    return { error: "選手交代に失敗しました" };
  }

  // For pinch runner: update runners_after on the latest at-bat to reference new lineup
  if (input.type === "pinch_runner" && input.replacedLineupId) {
    const { data: lastAtBat } = await supabase
      .from("at_bats")
      .select("id, runners_after")
      .eq("game_id", input.gameId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lastAtBat?.runners_after) {
      const updated = (lastAtBat.runners_after as { base: string; lineup_id: string }[]).map(
        (ra) => ra.lineup_id === input.replacedLineupId
          ? { ...ra, lineup_id: newLineup.id }
          : ra
      );
      await supabase
        .from("at_bats")
        .update({ runners_after: updated })
        .eq("id", lastAtBat.id);
    }
  }

  revalidatePath(`/games/${input.gameId}`);
  return { ok: true };
}

// ---- Position change ----

export async function changePositionAction(input: {
  gameId: string;
  changes: { lineupId: string; newPosition: string }[];
}) {
  const parsed = parseOrError(changePositionSchema, input);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  for (const change of input.changes) {
    const { error } = await supabase
      .from("lineups")
      .update({ position: change.newPosition })
      .eq("id", change.lineupId);

    if (error) {
      console.error("changePosition error:", error);
      return { error: "守備変更に失敗しました" };
    }
  }

  revalidatePath(`/games/${input.gameId}`);
  return { ok: true };
}

export async function finishGameAction(gameId: string) {
  if (!gameId) return { error: "試合IDが不正です" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Check game status
  {
    const { data: game } = await supabase
      .from("games")
      .select("status")
      .eq("id", gameId)
      .single();

    if (!game || game.status !== "in_progress") {
      return { error: "試合が進行中ではありません" };
    }
  }

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

export async function updateGameAction(input: {
  gameId: string;
  opponentName: string;
  gameDate: string;
  location: string;
  isHome: boolean;
  innings: number;
  useDh: boolean;
}) {
  const parsed = parseOrError(updateGameSchema, input);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  const opponentName = input.opponentName.trim();
  if (!opponentName) return { error: "相手チーム名を入力してください" };

  // Only scheduled games can be edited
  const { data: game } = await supabase
    .from("games")
    .select("status")
    .eq("id", input.gameId)
    .single();

  if (!game) return { error: "試合が見つかりません" };
  if (game.status !== "scheduled") return { error: "試合前の試合のみ編集できます" };

  const { error } = await supabase
    .from("games")
    .update({
      opponent_name: opponentName,
      game_date: input.gameDate,
      location: input.location.trim() || null,
      is_home: input.isHome,
      innings: input.innings,
      use_dh: input.useDh,
    })
    .eq("id", input.gameId);

  if (error) {
    console.error("updateGame error:", error);
    return { error: "試合の更新に失敗しました" };
  }

  revalidatePath("/");
  revalidatePath(`/games/${input.gameId}`);
  return { ok: true };
}

export async function deleteGameAction(gameId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Only scheduled games can be deleted
  const { data: game } = await supabase
    .from("games")
    .select("status")
    .eq("id", gameId)
    .single();

  if (!game) return { error: "試合が見つかりません" };
  if (game.status !== "scheduled") return { error: "試合前の試合のみ削除できます" };

  const { error } = await supabase
    .from("games")
    .delete()
    .eq("id", gameId);

  if (error) {
    console.error("deleteGame error:", error);
    return { error: "試合の削除に失敗しました" };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function startGameAction(gameId: string) {
  if (!gameId) return { error: "試合IDが不正です" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Check game status
  const { data: game } = await supabase
    .from("games")
    .select("status")
    .eq("id", gameId)
    .single();

  if (!game) return { error: "試合が見つかりません" };
  if (game.status !== "scheduled") return { error: "試合前の試合のみ開始できます" };

  // Check lineup exists
  const { count } = await supabase
    .from("lineups")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);

  if (!count || count === 0) {
    return { error: "オーダーが登録されていません" };
  }

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

// ---- Undo last at-bat ----

export async function undoLastAtBatAction(gameId: string) {
  if (!gameId) return { error: "試合IDが不正です" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Check game status
  const { data: game } = await supabase
    .from("games")
    .select("status")
    .eq("id", gameId)
    .single();

  if (!game || game.status !== "in_progress") {
    return { error: "試合が進行中ではありません" };
  }

  // Get the latest at-bat
  const { data: lastAtBat } = await supabase
    .from("at_bats")
    .select("id, inning, inning_half, batting_order, lineup_id, result")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!lastAtBat) {
    return { error: "取り消す打席がありません" };
  }

  // Get runner_events for this at-bat (to reverse pitching stats)
  const { data: runnerEvents } = await supabase
    .from("runner_events")
    .select("lineup_id, event_type")
    .eq("at_bat_id", lastAtBat.id);

  // Reverse pitching stats
  if (lastAtBat.result) {
    const destinations = (runnerEvents ?? [])
      .filter((e) => e.event_type === "scored" || e.event_type === "out")
      .map((e) => ({
        lineupId: e.lineup_id,
        event: e.event_type as "scored" | "out",
      }));

    const delta = getPitchingStatsDelta(lastAtBat.result, destinations);
    const hasDelta =
      delta.outs > 0 ||
      delta.hits > 0 ||
      delta.runs > 0 ||
      delta.walks > 0 ||
      delta.strikeouts > 0;

    if (hasDelta) {
      const fieldingSide = lastAtBat.inning_half === "top" ? "home" : "visitor";

      const { data: openRecords } = await supabase
        .from("pitching_records")
        .select("id, lineup_id, outs_recorded, hits, runs, earned_runs, walks, strikeouts")
        .eq("game_id", gameId)
        .is("inning_to", null);

      const { data: fieldingLineups } = await supabase
        .from("lineups")
        .select("id")
        .eq("game_id", gameId)
        .eq("team_side", fieldingSide);

      const fieldingIds = new Set((fieldingLineups ?? []).map((l) => l.id));
      const pitcherRecord = (openRecords ?? []).find((r) => fieldingIds.has(r.lineup_id));

      if (pitcherRecord) {
        await supabase
          .from("pitching_records")
          .update({
            outs_recorded: Math.max(0, pitcherRecord.outs_recorded - delta.outs),
            hits: Math.max(0, pitcherRecord.hits - delta.hits),
            runs: Math.max(0, pitcherRecord.runs - delta.runs),
            earned_runs: Math.max(0, pitcherRecord.earned_runs - delta.earnedRuns),
            walks: Math.max(0, pitcherRecord.walks - delta.walks),
            strikeouts: Math.max(0, pitcherRecord.strikeouts - delta.strikeouts),
          })
          .eq("id", pitcherRecord.id);
      }
    }
  }

  // Delete the at-bat (CASCADE deletes pitches, base_runners, runner_events)
  const { error: deleteError } = await supabase
    .from("at_bats")
    .delete()
    .eq("id", lastAtBat.id);

  if (deleteError) {
    console.error("undoLastAtBat delete error:", deleteError);
    return { error: "打席の取り消しに失敗しました" };
  }

  revalidatePath(`/games/${gameId}`);
  return {
    ok: true,
    undone: {
      inning: lastAtBat.inning,
      inningHalf: lastAtBat.inning_half,
      battingOrder: lastAtBat.batting_order,
      result: lastAtBat.result,
    },
  };
}

// ---- Runner advance (WP/PB/BK) ----

export async function recordRunnerAdvanceAction(input: {
  gameId: string;
  eventType: "wild_pitch" | "passed_ball" | "balk";
  advances: { lineupId: string; fromBase: "1st" | "2nd" | "3rd"; toBase: "2nd" | "3rd" | "home" }[];
}) {
  const parsed = parseOrError(recordRunnerAdvanceSchema, input);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Check game status
  const { data: game } = await supabase
    .from("games")
    .select("status")
    .eq("id", input.gameId)
    .single();

  if (!game || game.status !== "in_progress") {
    return { error: "試合が進行中ではありません" };
  }

  // Find the most recent at-bat
  const { data: lastAtBat } = await supabase
    .from("at_bats")
    .select("id, runners_after")
    .eq("game_id", input.gameId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!lastAtBat) {
    return { error: "打席が記録されていないためイベントを記録できません" };
  }

  // Insert runner_events for each advancing runner
  for (const advance of input.advances) {
    const { error: reError } = await supabase.from("runner_events").insert({
      at_bat_id: lastAtBat.id,
      lineup_id: advance.lineupId,
      event_type: input.eventType,
    });

    if (reError) {
      console.error("recordRunnerAdvance runner_event error:", reError);
      return { error: "走者進塁の記録に失敗しました" };
    }

    // If runner advanced to home, also insert scored event
    if (advance.toBase === "home") {
      const { error: scoredError } = await supabase.from("runner_events").insert({
        at_bat_id: lastAtBat.id,
        lineup_id: advance.lineupId,
        event_type: "scored",
      });

      if (scoredError) {
        console.error("recordRunnerAdvance scored error:", scoredError);
      }
    }
  }

  // Update runners_after on the at-bat to reflect new positions
  if (lastAtBat.runners_after) {
    const currentRunners = lastAtBat.runners_after as { base: string; lineup_id: string }[];
    const advanceMap = new Map(input.advances.map((a) => [a.lineupId, a]));

    const updatedRunners = currentRunners
      .map((r) => {
        const advance = advanceMap.get(r.lineup_id);
        if (advance) {
          if (advance.toBase === "home") return null; // scored, remove from bases
          return { ...r, base: advance.toBase };
        }
        return r;
      })
      .filter((r): r is { base: string; lineup_id: string } => r !== null);

    await supabase
      .from("at_bats")
      .update({ runners_after: updatedRunners })
      .eq("id", lastAtBat.id);
  }

  revalidatePath(`/games/${input.gameId}`);
  return { ok: true };
}
