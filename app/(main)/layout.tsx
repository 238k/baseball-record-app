import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-1">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/" className="text-lg sm:text-xl font-bold shrink-0">
              ⚾ <span className="hidden sm:inline">野球記録</span><span className="sm:hidden">記録</span>
            </Link>
            <nav className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
              <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                トップ
              </Link>
              <Link href="/games" className="text-muted-foreground hover:text-foreground transition-colors">
                試合
              </Link>
              <Link href="/teams" className="text-muted-foreground hover:text-foreground transition-colors">
                チーム
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {profile?.display_name}
            </span>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 sm:h-9 sm:w-9">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="h-8 px-2 sm:h-9 sm:px-3">
                <LogOut className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">ログアウト</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">{children}</main>
    </div>
  );
}
