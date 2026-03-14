"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface StealRunnerOption {
  lineupId: string;
  playerName: string;
  fromBase: "1st" | "2nd" | "3rd";
}

interface StealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runnerOptions: StealRunnerOption[];
  saving: boolean;
  onSteal: (lineupId: string, eventType: "stolen_base" | "caught_stealing") => void;
}

export function StealDialog({
  open,
  onOpenChange,
  runnerOptions,
  saving,
  onSteal,
}: StealDialogProps) {
  const [lineupId, setLineupId] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setLineupId("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>盗塁</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">走者を選択</label>
            <Select value={lineupId} onValueChange={setLineupId}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="走者を選択" />
              </SelectTrigger>
              <SelectContent>
                {runnerOptions.map((r) => (
                  <SelectItem key={r.lineupId} value={r.lineupId} className="text-base">
                    {r.fromBase === "1st" ? "1塁" : r.fromBase === "2nd" ? "2塁" : "3塁"}: {r.playerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Button
              size="lg"
              className="flex-1 min-h-16 text-lg"
              disabled={!lineupId || saving}
              onClick={() => {
                onSteal(lineupId, "stolen_base");
                setLineupId("");
              }}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              成功
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="flex-1 min-h-16 text-lg"
              disabled={!lineupId || saving}
              onClick={() => {
                onSteal(lineupId, "caught_stealing");
                setLineupId("");
              }}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              失敗
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
