"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createTeamAction(teamName: string) {
  const supabase = await createClient();
  // セッションをメモリに読み込んでからDBリクエストを送る
  await supabase.auth.getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  const name = teamName.trim();
  if (!name) return { error: "チーム名を入力してください" };

  const { data: createdTeam, error: insertError } = await supabase
    .from("teams")
    .insert({ name, owner_id: user.id })
    .select("id")
    .single();

  if (insertError || !createdTeam) {
    console.error("createTeam user:", user?.id, "insertError:", JSON.stringify(insertError));
    return { error: "チームの作成に失敗しました" };
  }

  revalidatePath("/");
  return { teamId: createdTeam.id };
}

export async function joinTeamAction(inviteCode: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  const code = inviteCode.trim();
  if (!code) return { error: "招待コードを入力してください" };

  const { data: teamId, error: rpcError } = await supabase.rpc(
    "join_team_by_invite_code",
    { p_invite_code: code }
  );

  if (rpcError) {
    if (rpcError.message.includes("team_not_found")) {
      return { error: "招待コードが見つかりません" };
    }
    if (rpcError.message.includes("already_member")) {
      return { error: "すでにこのチームのメンバーです" };
    }
    return { error: "参加に失敗しました" };
  }

  revalidatePath("/");
  revalidatePath(`/team/${teamId}`);
  return { ok: true };
}

export async function promoteMemberAction(memberId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  const { error: rpcError } = await supabase.rpc("promote_team_member", {
    p_member_id: memberId,
  });

  if (rpcError) {
    if (rpcError.message.includes("not_authorized")) {
      return { error: "管理者権限が必要です" };
    }
    if (rpcError.message.includes("member_not_found")) {
      return { error: "メンバーが見つかりません" };
    }
    return { error: "昇格に失敗しました" };
  }

  return { ok: true };
}

export async function forceReleaseSessionAction(gameId: string, teamId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Check admin role
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("profile_id", user.id)
    .single();

  if (!membership || membership.role !== "admin") {
    return { error: "管理者権限が必要です" };
  }

  // Delete the session
  const { error } = await supabase
    .from("game_input_sessions")
    .delete()
    .eq("game_id", gameId);

  if (error) {
    console.error("forceReleaseSession error:", error);
    return { error: "セッションの解除に失敗しました" };
  }

  // Also reject any pending requests
  await supabase
    .from("game_input_requests")
    .update({ status: "rejected" })
    .eq("game_id", gameId)
    .eq("status", "pending");

  revalidatePath(`/team/${teamId}`);
  return { ok: true };
}

export async function updateTeamNameAction(teamId: string, teamName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  const name = teamName.trim();
  if (!name) return { error: "チーム名を入力してください" };

  const { error: updateError } = await supabase
    .from("teams")
    .update({ name })
    .eq("id", teamId);

  if (updateError) {
    return { error: "更新に失敗しました" };
  }

  revalidatePath("/");
  revalidatePath(`/team/${teamId}`);
  return { ok: true };
}
