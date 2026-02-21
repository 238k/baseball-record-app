"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createGameAction } from "@/app/(main)/games/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Team {
  id: string;
  name: string;
}

export default function NewGamePage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [gameDate, setGameDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [location, setLocation] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [innings, setInnings] = useState(9);
  const [useDh, setUseDh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberships } = await supabase
        .from("team_members")
        .select("teams(id, name)")
        .eq("profile_id", user.id);

      const t = (memberships ?? []).flatMap((m) => {
        if (!m.teams) return [];
        const team = m.teams as { id: string; name: string };
        return [{ id: team.id, name: team.name }];
      });
      setTeams(t);
      if (t.length === 1) setTeamId(t[0].id);
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) {
      setError("チームを選択してください");
      return;
    }
    setLoading(true);
    setError(null);

    const result = await createGameAction({
      teamId,
      opponentName,
      gameDate,
      location,
      isHome,
      innings,
      useDh,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(`/games/${result.gameId}/lineup`);
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Link
        href="/"
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        戻る
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">新規試合登録</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {teams.length > 1 && (
              <div className="space-y-2">
                <Label>チーム <span className="text-destructive">*</span></Label>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger className="text-lg h-14">
                    <SelectValue placeholder="チームを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-lg">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="opponentName">
                相手チーム名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="opponentName"
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                placeholder="例：○○シニア"
                required
                className="text-lg h-14"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gameDate">
                試合日 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="gameDate"
                type="date"
                value={gameDate}
                onChange={(e) => setGameDate(e.target.value)}
                required
                className="text-lg h-14"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">場所</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例：○○球場"
                className="text-lg h-14"
              />
            </div>

            <div className="space-y-2">
              <Label>ホーム / ビジター</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={isHome ? "default" : "outline"}
                  size="lg"
                  className="flex-1 min-h-14 text-lg"
                  onClick={() => setIsHome(true)}
                >
                  ホーム
                </Button>
                <Button
                  type="button"
                  variant={!isHome ? "default" : "outline"}
                  size="lg"
                  className="flex-1 min-h-14 text-lg"
                  onClick={() => setIsHome(false)}
                >
                  ビジター
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="innings">イニング数</Label>
              <Input
                id="innings"
                type="number"
                min={1}
                max={15}
                value={innings}
                onChange={(e) => setInnings(Number(e.target.value))}
                className="text-lg h-14"
              />
            </div>

            <div className="space-y-2">
              <Label>DH制</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!useDh ? "default" : "outline"}
                  size="lg"
                  className="flex-1 min-h-14 text-lg"
                  onClick={() => setUseDh(false)}
                >
                  なし
                </Button>
                <Button
                  type="button"
                  variant={useDh ? "default" : "outline"}
                  size="lg"
                  className="flex-1 min-h-14 text-lg"
                  onClick={() => setUseDh(true)}
                >
                  あり
                </Button>
              </div>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button
              type="submit"
              size="lg"
              className="w-full min-h-16 text-lg"
              disabled={loading}
            >
              {loading && (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              )}
              登録してオーダー入力へ
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
