"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { LineupPlayer } from "@/hooks/useGameState";

interface AvailablePlayer {
  id: string;
  name: string;
  number: string | null;
  position: string | null;
}

interface PositionChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldingLineup: LineupPlayer[];
  fieldingTeamSide: string;
  ownTeamSide: string;
  availablePlayers: AvailablePlayer[];
  saving: boolean;
  onConfirm: (params: {
    posChanges: Record<string, string>;
    substitutions: Record<string, { newPlayerId: string | null; newPlayerName: string }>;
  }) => void;
}

const POSITIONS = ["投", "捕", "一", "二", "三", "遊", "左", "中", "右", "DH"];

export function PositionChangeDialog({
  open,
  onOpenChange,
  fieldingLineup,
  fieldingTeamSide,
  ownTeamSide,
  availablePlayers,
  saving,
  onConfirm,
}: PositionChangeDialogProps) {
  const [posChanges, setPosChanges] = useState<Record<string, string>>({});
  const [substitutions, setSubstitutions] = useState<Record<string, {
    newPlayerId: string | null;
    newPlayerName: string;
  }>>({});
  const [manualInput, setManualInput] = useState<Set<string>>(new Set());

  const initState = () => {
    const init: Record<string, string> = {};
    for (const l of fieldingLineup) {
      init[l.id] = l.position ?? "";
    }
    setPosChanges(init);
    setSubstitutions({});
    setManualInput(new Set());
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) initState();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>守備変更</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {fieldingLineup.map((l) => {
            const hasSub = !!substitutions[l.id];
            return (
              <div key={l.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm w-20 sm:w-28 truncate shrink-0">
                    {l.batting_order}番 {l.player_name}
                  </span>
                  <Select
                    value={posChanges[l.id] ?? l.position ?? ""}
                    onValueChange={(val) => setPosChanges((prev) => ({ ...prev, [l.id]: val }))}
                  >
                    <SelectTrigger className="h-10 text-base flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((pos) => (
                        <SelectItem key={pos} value={pos} className="text-base">{pos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant={hasSub ? "secondary" : "outline"}
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      if (hasSub) {
                        setSubstitutions((prev) => {
                          const next = { ...prev };
                          delete next[l.id];
                          return next;
                        });
                      } else {
                        setSubstitutions((prev) => ({
                          ...prev,
                          [l.id]: { newPlayerId: null, newPlayerName: "" },
                        }));
                      }
                    }}
                  >
                    {hasSub ? "取消" : "交代"}
                  </Button>
                </div>
                {hasSub && (
                  <div className="pl-8 space-y-1">
                    {fieldingTeamSide === ownTeamSide && availablePlayers.length > 0 && !manualInput.has(l.id) ? (
                      <>
                        <Select
                          value={substitutions[l.id]?.newPlayerId ?? ""}
                          onValueChange={(val) => {
                            const player = availablePlayers.find((p) => p.id === val);
                            if (player) {
                              setSubstitutions((prev) => ({
                                ...prev,
                                [l.id]: { newPlayerId: player.id, newPlayerName: player.name },
                              }));
                            }
                          }}
                        >
                          <SelectTrigger className="h-10 text-base">
                            <SelectValue placeholder="交代選手を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {availablePlayers.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-base">
                                {p.number ? `#${p.number} ` : ""}{p.name}{p.position ? `（${p.position}）` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                          onClick={() => {
                            setManualInput((prev) => new Set(prev).add(l.id));
                            setSubstitutions((prev) => ({
                              ...prev,
                              [l.id]: { newPlayerId: null, newPlayerName: "" },
                            }));
                          }}
                        >
                          手入力
                        </button>
                      </>
                    ) : (
                      <>
                        <Input
                          className="text-base h-10"
                          placeholder="交代選手名を入力"
                          value={substitutions[l.id]?.newPlayerName ?? ""}
                          onChange={(e) => {
                            setSubstitutions((prev) => ({
                              ...prev,
                              [l.id]: { ...prev[l.id], newPlayerId: null, newPlayerName: e.target.value },
                            }));
                          }}
                        />
                        {fieldingTeamSide === ownTeamSide && availablePlayers.length > 0 && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                            onClick={() => {
                              setManualInput((prev) => {
                                const next = new Set(prev);
                                next.delete(l.id);
                                return next;
                              });
                              setSubstitutions((prev) => ({
                                ...prev,
                                [l.id]: { newPlayerId: null, newPlayerName: "" },
                              }));
                            }}
                          >
                            一覧から選択
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            disabled={saving || Object.values(substitutions).some((s) => !s.newPlayerName.trim())}
            onClick={() => {
              onConfirm({ posChanges, substitutions });
            }}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            変更する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
