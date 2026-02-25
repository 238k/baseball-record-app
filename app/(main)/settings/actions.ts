"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfileAction(input: {
  displayName: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  const displayName = input.displayName.trim();
  if (!displayName) return { error: "表示名を入力してください" };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) {
    console.error("updateProfile error:", error);
    return { error: "プロフィールの更新に失敗しました" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateDefaultTeamAction(teamId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  // Validate membership if teamId is provided
  if (teamId) {
    const { data: membership } = await supabase
      .from("team_members")
      .select("profile_id")
      .eq("team_id", teamId)
      .eq("profile_id", user.id)
      .single();

    if (!membership) return { error: "所属していないチームは選択できません" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ default_team_id: teamId })
    .eq("id", user.id);

  if (error) {
    console.error("updateDefaultTeam error:", error);
    return { error: "デフォルトチームの更新に失敗しました" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
