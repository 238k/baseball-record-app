"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
