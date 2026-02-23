"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { updateGameAction } from "@/app/(main)/games/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";

interface GameData {
  id: string;
  opponent_name: string;
  game_date: string;
  location: string | null;
  is_home: boolean;
  innings: number;
  use_dh: boolean;
  status: string;
}

export default function GameEditPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const [game, setGame] = useState<GameData | null>(null);
  const [opponentName, setOpponentName] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [location, setLocation] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [innings, setInnings] = useState(9);
  const [useDh, setUseDh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("games")
        .select("id, opponent_name, game_date, location, is_home, innings, use_dh, status")
        .eq("id", gameId)
        .single();

      if (!data) {
        setError("試合が見つかりません");
        setLoading(false);
        return;
      }

      if (data.status !== "scheduled") {
        setError("試合前の試合のみ編集できます");
        setLoading(false);
        return;
      }

      setGame(data);
      setOpponentName(data.opponent_name);
      setGameDate(data.game_date);
      setLocation(data.location ?? "");
      setIsHome(data.is_home);
      setInnings(data.innings);
      setUseDh(data.use_dh);
      setLoading(false);
    };
    load();
  }, [gameId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = await updateGameAction({
      gameId,
      opponentName,
      gameDate,
      location,
      isHome,
      innings,
      useDh,
    });

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    router.push(`/games/${gameId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="space-y-4 text-center py-16">
        <p className="text-destructive">{error ?? "試合が見つかりません"}</p>
        <Button variant="outline" onClick={() => router.push(`/games/${gameId}`)}>
          試合詳細に戻る
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Link
        href={`/games/${gameId}`}
        prefetch={false}
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        試合詳細に戻る
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">試合情報を編集</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              保存する
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
