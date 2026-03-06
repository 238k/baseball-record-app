import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";
import { MobileNav } from "@/components/mobile-nav";

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
            <MobileNav
              displayName={profile?.display_name}
              signOutAction={signOut}
            />
            <Link href="/" className="text-lg sm:text-xl font-bold shrink-0">
              ⚾ <span className="hidden md:inline">野球記録</span><span className="md:hidden">記録</span>
            </Link>
            <nav className="hidden md:flex items-center gap-3 text-sm">
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
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <span className="text-sm text-muted-foreground">
              {profile?.display_name}
            </span>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="h-9 px-3">
                <LogOut className="h-4 w-4 mr-1" />
                ログアウト
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">{children}</main>
    </div>
  );
}
