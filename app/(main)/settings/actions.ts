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
