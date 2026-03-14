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
import type { BaseRunners, LineupPlayer } from "@/hooks/useGameState";

interface AvailablePlayer {
  id: string;
  name: string;
  number: string | null;
  position: string | null;
}

interface SubstitutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBatter: LineupPlayer | undefined;
  baseRunners: BaseRunners;
  battingTeamSide: string;
  ownTeamSide: string;
  availablePlayers: AvailablePlayer[];
  saving: boolean;
  onConfirm: (params: {
    type: "pinch_hitter" | "pinch_runner";
    targetLineupId: string;
    newPlayerId: string | null;
    newPlayerName: string;
    newPosition: string;
  }) => void;
}

const POSITIONS = ["投", "捕", "一", "二", "三", "遊", "左", "中", "右", "DH"];

export function SubstitutionDialog({
  open,
  onOpenChange,
  currentBatter,
  baseRunners,
  battingTeamSide,
  ownTeamSide,
  availablePlayers,
  saving,
  onConfirm,
}: SubstitutionDialogProps) {
  const [subType, setSubType] = useState<"pinch_hitter" | "pinch_runner">("pinch_hitter");
  const [targetLineupId, setTargetLineupId] = useState("");
  const [newPlayerId, setNewPlayerId] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPosition, setNewPosition] = useState("");

  const resetState = () => {
    setSubType("pinch_hitter");
    setTargetLineupId("");
    setNewPlayerId(null);
    setNewPlayerName("");
    setNewPosition("");
  };

  const isOwnTeam = battingTeamSide === ownTeamSide;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetState();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>選手交代</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={subType === "pinch_hitter" ? "default" : "outline"}
              size="lg"
              className="flex-1"
              onClick={() => {
                setSubType("pinch_hitter");
                setTargetLineupId("");
              }}
            >
              代打
            </Button>
            <Button
              variant={subType === "pinch_runner" ? "default" : "outline"}
              size="lg"
              className="flex-1"
              onClick={() => setSubType("pinch_runner")}
            >
              代走
            </Button>
          </div>

          {subType === "pinch_hitter" && currentBatter && (
            <div className="text-sm text-muted-foreground">
              対象: {currentBatter.batting_order}番 {currentBatter.player_name}（{currentBatter.position}）
            </div>
          )}

          {subType === "pinch_runner" && (
            <div className="space-y-1">
              <label className="text-sm font-medium">走者を選択</label>
              <Select value={targetLineupId} onValueChange={setTargetLineupId}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="走者を選択" />
                </SelectTrigger>
                <SelectContent>
                  {baseRunners.first && (
                    <SelectItem value={baseRunners.first.id} className="text-base">
                      1塁: {baseRunners.first.player_name}
                    </SelectItem>
                  )}
                  {baseRunners.second && (
                    <SelectItem value={baseRunners.second.id} className="text-base">
                      2塁: {baseRunners.second.player_name}
                    </SelectItem>
                  )}
                  {baseRunners.third && (
                    <SelectItem value={baseRunners.third.id} className="text-base">
                      3塁: {baseRunners.third.player_name}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {isOwnTeam && availablePlayers.length > 0 ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">交代選手</label>
              <Select
                value={newPlayerId ?? ""}
                onValueChange={(val) => {
                  const player = availablePlayers.find((p) => p.id === val);
                  if (player) {
                    setNewPlayerId(player.id);
                    setNewPlayerName(player.name);
                    setNewPosition(player.position ?? currentBatter?.position ?? "");
                  }
                }}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="選手を選択" />
                </SelectTrigger>
                <SelectContent>
                  {availablePlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-base">
                      {p.number ? `#${p.number} ` : ""}{p.name}{p.position ? `（${p.position}）` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-sm font-medium">交代選手名</label>
              <Input
                className="text-lg h-14"
                placeholder="選手名を入力"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">守備位置</label>
            <Select value={newPosition} onValueChange={setNewPosition}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="守備位置" />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map((pos) => (
                  <SelectItem key={pos} value={pos} className="text-base">{pos}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            disabled={
              saving ||
              !newPlayerName.trim() ||
              (subType === "pinch_runner" && !targetLineupId)
            }
            onClick={() => {
              onConfirm({
                type: subType,
                targetLineupId,
                newPlayerId,
                newPlayerName: newPlayerName.trim(),
                newPosition: newPosition || currentBatter?.position || "",
              });
              resetState();
            }}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            交代する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
