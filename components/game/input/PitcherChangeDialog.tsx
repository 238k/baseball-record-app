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
import { Loader2 } from "lucide-react";
import type { LineupPlayer } from "@/hooks/useGameState";

interface PitcherChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldingLineup: LineupPlayer[];
  saving: boolean;
  onConfirm: (lineupId: string) => void;
}

export function PitcherChangeDialog({
  open,
  onOpenChange,
  fieldingLineup,
  saving,
  onConfirm,
}: PitcherChangeDialogProps) {
  const [selectedId, setSelectedId] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setSelectedId("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>投手交代</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">新しい投手を選択</label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="投手を選択" />
            </SelectTrigger>
            <SelectContent>
              {fieldingLineup.map((l) => (
                <SelectItem key={l.id} value={l.id} className="text-base">
                  {l.player_name ?? "—"} ({l.position})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={() => {
              onConfirm(selectedId);
              setSelectedId("");
            }}
            disabled={!selectedId || saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            交代する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
