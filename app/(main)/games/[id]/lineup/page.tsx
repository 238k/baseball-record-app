"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  saveLineupAction,
  updateGameDhAction,
} from "@/app/(main)/games/actions";
import {
  LineupEditor,
  type LineupEntry,
} from "@/components/game/LineupEditor";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ChevronLeft, Loader2, Pencil, Save, SkipForward } from "lucide-react";

interface Player {
  id: string;
  name: string;
  number: string | null;
  position: string | null;
}

interface GameData {
  id: string;
  team_id: string | null;
  opponent_name: string;
  is_home: boolean;
  status: string;
  use_dh: boolean;
  is_free_mode: boolean;
  home_team_name: string | null;
  visitor_team_name: string | null;
}

const POSITIONS_NORMAL = ["投", "捕", "一", "二", "三", "遊", "左", "中", "右"];
const POSITIONS_DH = ["DH", "捕", "一", "二", "三", "遊", "左", "中", "右"];

const UNREGISTERED_PITCHER = "__unregistered_pitcher__";

function createEmptyLineup(useDh: boolean): LineupEntry[] {
  const positions = useDh ? POSITIONS_DH : POSITIONS_NORMAL;
  return positions.map((pos, i) => ({
    battingOrder: i + 1,
    playerId: null,
    playerName: null,
    position: pos,
  }));
}

function getPitcherOrder(lineup: LineupEntry[]): number {
  return lineup.find((e) => e.position === "投")?.battingOrder ?? 1;
}

function getDhBattingOrder(lineup: LineupEntry[]): number | null {
  const dh = lineup.find((e) => e.position === "DH");
  return dh ? dh.battingOrder : null;
}

export default function LineupPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const [game, setGame] = useState<GameData | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [homeLineup, setHomeLineup] = useState<LineupEntry[]>([]);
  const [visitorLineup, setVisitorLineup] = useState<LineupEntry[]>([]);
  const [myDhPitcher, setMyDhPitcher] = useState<{
    playerId: string | null;
    playerName: string;
  } | null>(null);
  const [opponentDhPitcher, setOpponentDhPitcher] = useState<{
    playerId: string | null;
    playerName: string;
  } | null>(null);
  const [myDhPitcherIsUnregistered, setMyDhPitcherIsUnregistered] =
    useState(false);
  const [step, setStep] = useState<"my-team" | "opponent">("my-team");
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const { data: gameData } = await supabase
        .from("games")
        .select("id, team_id, opponent_name, is_home, status, use_dh, is_free_mode, home_team_name, visitor_team_name")
        .eq("id", gameId)
        .single();

      if (!gameData) return;
      const normalizedGame: GameData = {
        ...gameData,
        use_dh: gameData.use_dh ?? false,
        is_free_mode: gameData.is_free_mode ?? false,
      };
      const useDh = normalizedGame.use_dh;
      setGame(normalizedGame);

      // Fetch players (skip for free mode)
      if (!normalizedGame.is_free_mode && normalizedGame.team_id) {
        const { data: playerData } = await supabase
          .from("players")
          .select("id, name, number, position")
          .eq("team_id", normalizedGame.team_id)
          .eq("is_active", true);

        setPlayers(playerData ?? []);
      }

      // Load existing lineups
      const { data: existingLineups } = await supabase
        .from("lineups")
        .select("batting_order, team_side, player_id, player_name, position")
        .eq("game_id", gameId)
        .order("batting_order");

      if (existingLineups && existingLineups.length > 0) {
        const home = createEmptyLineup(useDh);
        const visitor = createEmptyLineup(useDh);

        // Separate DH pitcher entries (position=投 sharing batting_order with a DH entry)
        const homePitcherEntries: typeof existingLineups = [];
        const visitorPitcherEntries: typeof existingLineups = [];
        const dhOrders = { home: new Set<number>(), visitor: new Set<number>() };

        // First pass: identify DH entries
        for (const l of existingLineups) {
          if (l.position === "DH") {
            dhOrders[l.team_side as "home" | "visitor"].add(l.batting_order);
          }
        }

        for (const l of existingLineups) {
          // Detect pitcher entries paired with DH (same batting_order, position=投)
          const side = l.team_side as "home" | "visitor";
          if (l.position === "投" && dhOrders[side].has(l.batting_order)) {
            if (side === "home") homePitcherEntries.push(l);
            else visitorPitcherEntries.push(l);
            continue;
          }

          const target = l.team_side === "home" ? home : visitor;
          const defaultPositions = useDh ? POSITIONS_DH : POSITIONS_NORMAL;
          const idx = target.findIndex(
            (e) => e.battingOrder === l.batting_order
          );
          if (idx >= 0) {
            target[idx] = {
              battingOrder: l.batting_order,
              playerId: l.player_id,
              playerName: l.player_name,
              position: l.position ?? defaultPositions[idx],
            };
          }
        }

        // Restore DH pitcher state
        const myPitcherEntries = normalizedGame.is_home ? homePitcherEntries : visitorPitcherEntries;
        const oppPitcherEntries = normalizedGame.is_home ? visitorPitcherEntries : homePitcherEntries;
        if (myPitcherEntries.length > 0) {
          const p = myPitcherEntries[0];
          setMyDhPitcher({ playerId: p.player_id, playerName: p.player_name ?? "" });
          if (!p.player_id) {
            setMyDhPitcherIsUnregistered(true);
          }
        }
        if (oppPitcherEntries.length > 0) {
          const p = oppPitcherEntries[0];
          setOpponentDhPitcher({ playerId: p.player_id, playerName: p.player_name ?? "" });
        }

        setHomeLineup(home);
        setVisitorLineup(visitor);
      } else {
        // No existing data — initialize empty lineups
        setHomeLineup(createEmptyLineup(useDh));
        setVisitorLineup(createEmptyLineup(useDh));
      }

      setLoadingPage(false);
    };
    load();
  }, [gameId]);

  // Warn on browser-level navigation (tab close, refresh) when there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    if (isDirty) {
      window.addEventListener("beforeunload", handler);
    }
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleDhToggle = async (newUseDh: boolean) => {
    if (!game || game.use_dh === newUseDh) return;

    // Update DB
    const result = await updateGameDhAction(gameId, newUseDh);
    if (result.error) {
      setError(result.error);
      return;
    }

    // Update local game state
    setGame({ ...game, use_dh: newUseDh });

    // Convert lineup positions
    const convertLineup = (lineup: LineupEntry[]): LineupEntry[] =>
      lineup.map((e) => {
        if (newUseDh && e.position === "投") {
          return { ...e, position: "DH" };
        }
        if (!newUseDh && e.position === "DH") {
          return { ...e, position: "投" };
        }
        return e;
      });

    setHomeLineup(convertLineup(homeLineup));
    setVisitorLineup(convertLineup(visitorLineup));

    // Clear DH pitcher state when switching off
    if (!newUseDh) {
      setMyDhPitcher(null);
      setMyDhPitcherIsUnregistered(false);
      setOpponentDhPitcher(null);
    }

    setIsDirty(true);
  };

  const handleSave = async (skipOpponent = false) => {
    if (!game) return;
    setSaving(true);
    setError(null);

    // Client-side validation
    const myMissingPlayers = myTeamLineup.filter(
      (e) => !e.playerId && !e.playerName
    );
    if (myMissingPlayers.length > 0) {
      const orders = myMissingPlayers.map((e) => e.battingOrder).join(", ");
      setError(`自チームの ${orders} 番打者が未設定です`);
      setSaving(false);
      return;
    }

    if (game.use_dh && !myDhPitcher?.playerName) {
      setError("自チームの先発投手を設定してください");
      setSaving(false);
      return;
    }

    // If opponent lineup was skipped, use empty lineup with placeholder names
    // Free mode always uses the real opponent lineup
    const opponentEntered = !skipOpponent && (step === "opponent" || game.is_free_mode);
    const actualOpponentLineup = opponentEntered
      ? opponentLineup
      : createEmptyLineup(game.use_dh);

    // Fill placeholder names for opponent entries without names
    const filledOpponent = actualOpponentLineup.map((e) => ({
      ...e,
      playerName: e.playerName || `相手選手${e.battingOrder}`,
    }));

    if (opponentEntered && game.use_dh && !opponentDhPitcher?.playerName) {
      setError(`${opponentLabel}の先発投手を設定してください`);
      setSaving(false);
      return;
    }

    const result = await saveLineupAction({
      gameId,
      homeLineup: game.is_home ? myTeamLineup : filledOpponent,
      visitorLineup: game.is_home ? filledOpponent : myTeamLineup,
      homePitcherOrder: game.is_home
        ? getDhBattingOrder(myTeamLineup) ?? getPitcherOrder(myTeamLineup)
        : getDhBattingOrder(filledOpponent) ?? getPitcherOrder(filledOpponent),
      visitorPitcherOrder: game.is_home
        ? getDhBattingOrder(filledOpponent) ?? getPitcherOrder(filledOpponent)
        : getDhBattingOrder(myTeamLineup) ?? getPitcherOrder(myTeamLineup),
      ...(game.use_dh
        ? game.is_home
          ? {
              homeDhPitcher: myDhPitcher ?? undefined,
              visitorDhPitcher:
                opponentEntered && opponentDhPitcher
                  ? opponentDhPitcher
                  : opponentEntered
                    ? undefined
                    : { playerId: null, playerName: `相手投手` },
            }
          : {
              homeDhPitcher:
                opponentEntered && opponentDhPitcher
                  ? opponentDhPitcher
                  : opponentEntered
                    ? undefined
                    : { playerId: null, playerName: `相手投手` },
              visitorDhPitcher: myDhPitcher ?? undefined,
            }
        : {}),
    });

    if (result.error) {
      setSaving(false);
      setError(result.error);
      return;
    }

    setIsDirty(false);
    router.push(`/games/${gameId}/input`);
  };

  if (loadingPage || !game) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Determine which lineup is "my team" vs "opponent"
  // Free mode: home is always "my team" side
  const myTeamLineup = (game.is_free_mode || game.is_home) ? homeLineup : visitorLineup;
  const opponentLineup = (game.is_free_mode || game.is_home) ? visitorLineup : homeLineup;

  const setMyTeamLineup = (game.is_free_mode || game.is_home) ? setHomeLineup : setVisitorLineup;
  const setOpponentLineup = (game.is_free_mode || game.is_home) ? setVisitorLineup : setHomeLineup;

  // Team labels
  const myTeamLabel = game.is_free_mode
    ? (game.home_team_name ?? "ホーム")
    : "自チーム";
  const opponentLabel = game.is_free_mode
    ? (game.visitor_team_name ?? "ビジター")
    : game.opponent_name;

  const sortedPlayers = [...players].sort((a, b) => {
    const na = parseInt(a.number ?? "", 10);
    const nb = parseInt(b.number ?? "", 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (isNaN(na) && !isNaN(nb)) return 1;
    if (!isNaN(na) && isNaN(nb)) return -1;
    return (a.number ?? "").localeCompare(b.number ?? "");
  });

  const handleNavBack = () => {
    if (isDirty) {
      setShowLeaveDialog(true);
    } else {
      router.push("/");
    }
  };

  // Validate my team lineup before proceeding to next step
  const handleNext = () => {
    setError(null);

    const myMissingPlayers = myTeamLineup.filter(
      (e) => !e.playerId && !e.playerName
    );
    if (myMissingPlayers.length > 0) {
      const orders = myMissingPlayers.map((e) => e.battingOrder).join(", ");
      setError(`${myTeamLabel}の ${orders} 番打者が未設定です`);
      return;
    }

    if (game.use_dh && !myDhPitcher?.playerName) {
      setError(`${myTeamLabel}の先発投手を設定してください`);
      return;
    }

    setStep("opponent");
  };

  // Filter DH pitcher dropdown: exclude players already in my lineup
  const myLineupPlayerIds = new Set(
    myTeamLineup.map((e) => e.playerId).filter(Boolean)
  );
  const availablePitchers = sortedPlayers.filter(
    (p) =>
      p.id === myDhPitcher?.playerId || !myLineupPlayerIds.has(p.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {step === "my-team" ? (
          <button
            type="button"
            onClick={handleNavBack}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            トップに戻る
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setStep("my-team"); setError(null); }}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {myTeamLabel}に戻る
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (isDirty) {
              setShowLeaveDialog(true);
            } else {
              router.push(`/games/${gameId}/edit`);
            }
          }}
          className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="mr-1 h-4 w-4" />
          試合設定
        </button>
      </div>

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ページを離れますか？</AlertDialogTitle>
            <AlertDialogDescription>
              保存されていない変更があります。このまま離れると変更は失われます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/")}>
              離れる
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {step === "my-team"
            ? `オーダー登録 - ${myTeamLabel}`
            : `オーダー登録 - ${opponentLabel}`}
        </h1>
        {step === "my-team" && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">DH制</span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant={!game.use_dh ? "default" : "outline"}
                size="sm"
                onClick={() => handleDhToggle(false)}
              >
                なし
              </Button>
              <Button
                type="button"
                variant={game.use_dh ? "default" : "outline"}
                size="sm"
                onClick={() => handleDhToggle(true)}
              >
                あり
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Step 1: My team lineup */}
      {step === "my-team" && (
        <>
          <LineupEditor
            title={myTeamLabel}
            players={game.is_free_mode ? [] : players}
            lineup={myTeamLineup}
            onChange={(v) => { setMyTeamLineup(v); markDirty(); }}
            allowUnregistered
          />

          {game.use_dh && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">先発投手</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Select
                  value={
                    myDhPitcherIsUnregistered
                      ? UNREGISTERED_PITCHER
                      : myDhPitcher?.playerId ?? ""
                  }
                  onValueChange={(v) => {
                    if (v === UNREGISTERED_PITCHER) {
                      setMyDhPitcherIsUnregistered(true);
                      setMyDhPitcher({ playerId: null, playerName: "" });
                    } else {
                      setMyDhPitcherIsUnregistered(false);
                      const p = sortedPlayers.find((pl) => pl.id === v);
                      if (p) {
                        setMyDhPitcher({ playerId: p.id, playerName: p.name });
                      }
                    }
                    markDirty();
                  }}
                >
                  <SelectTrigger className="text-base h-12">
                    <SelectValue placeholder="投手を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePitchers.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-base">
                        {p.number ? `#${p.number} ` : ""}
                        {p.name}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value={UNREGISTERED_PITCHER}
                      className="text-base"
                    >
                      未登録選手
                    </SelectItem>
                  </SelectContent>
                </Select>
                {myDhPitcherIsUnregistered && (
                  <Input
                    value={myDhPitcher?.playerName ?? ""}
                    onChange={(e) => {
                      setMyDhPitcher({
                        playerId: null,
                        playerName: e.target.value,
                      });
                      markDirty();
                    }}
                    placeholder="投手名を入力"
                    className="text-base h-10"
                  />
                )}
              </CardContent>
            </Card>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button
            size="lg"
            className="w-full min-h-16 text-lg"
            onClick={handleNext}
          >
            次へ — {opponentLabel}のオーダー入力
          </Button>
        </>
      )}

      {/* Step 2: Opponent lineup */}
      {step === "opponent" && (
        <>
          <LineupEditor
            title={opponentLabel}
            lineup={opponentLineup}
            onChange={(v) => { setOpponentLineup(v); markDirty(); }}
            allowUnregistered={game.is_free_mode}
          />

          {game.use_dh && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {opponentLabel} 先発投手
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={opponentDhPitcher?.playerName ?? ""}
                  onChange={(e) => {
                    setOpponentDhPitcher({
                      playerId: null,
                      playerName: e.target.value,
                    });
                    markDirty();
                  }}
                  placeholder="投手名を入力"
                  className="text-base h-12"
                />
              </CardContent>
            </Card>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex gap-3">
            <Button
              size="lg"
              variant="outline"
              className="flex-1 min-h-16 text-lg"
              onClick={() => handleSave(true)}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <SkipForward className="mr-2 h-5 w-5" />
              )}
              スキップして保存
            </Button>

            <Button
              size="lg"
              className="flex-1 min-h-16 text-lg"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Save className="mr-2 h-5 w-5" />
              )}
              オーダーを保存
            </Button>
          </div>

        </>
      )}
    </div>
  );
}
