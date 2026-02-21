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

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("invite_code", code)
    .single();

  if (teamError || !team) {
    return { error: "招待コードが見つかりません" };
  }

  const { error: joinError } = await supabase
    .from("team_members")
    .insert({ team_id: team.id, profile_id: user.id, role: "member" });

  if (joinError) {
    if (joinError.code === "23505") {
      return { error: "すでにこのチームのメンバーです" };
    }
    return { error: "参加に失敗しました" };
  }

  revalidatePath("/");
  revalidatePath(`/team/${team.id}`);
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
