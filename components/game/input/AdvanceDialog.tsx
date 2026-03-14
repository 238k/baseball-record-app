"use client";

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

interface AdvanceRunnerOption {
  lineupId: string;
  playerName: string;
  fromBase: "1st" | "2nd" | "3rd";
  defaultToBase: string;
}

interface AdvanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventType: "wild_pitch" | "passed_ball" | "balk";
  onEventTypeChange: (type: "wild_pitch" | "passed_ball" | "balk") => void;
  runnerOptions: AdvanceRunnerOption[];
  selections: Record<string, string>;
  onSelectionChange: (lineupId: string, toBase: string) => void;
  saving: boolean;
  onConfirm: () => void;
}

export function AdvanceDialog({
  open,
  onOpenChange,
  eventType,
  onEventTypeChange,
  runnerOptions,
  selections,
  onSelectionChange,
  saving,
  onConfirm,
}: AdvanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>WP / PB / BK</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["wild_pitch", "passed_ball", "balk"] as const).map((type) => (
              <Button
                key={type}
                variant={eventType === type ? "default" : "outline"}
                size="lg"
                className="flex-1"
                onClick={() => onEventTypeChange(type)}
              >
                {type === "wild_pitch" ? "WP" : type === "passed_ball" ? "PB" : "BK"}
              </Button>
            ))}
          </div>

          {runnerOptions.map((runner) => (
            <div key={runner.lineupId} className="space-y-1">
              <label className="text-sm font-medium">
                {runner.fromBase === "1st" ? "1塁" : runner.fromBase === "2nd" ? "2塁" : "3塁"}走者: {runner.playerName}
              </label>
              <Select
                value={selections[runner.lineupId] ?? "stay"}
                onValueChange={(v) => onSelectionChange(runner.lineupId, v)}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stay" className="text-base">そのまま</SelectItem>
                  {runner.fromBase === "1st" && (
                    <SelectItem value="2nd" className="text-base">→2塁</SelectItem>
                  )}
                  {(runner.fromBase === "1st" || runner.fromBase === "2nd") && (
                    <SelectItem value="3rd" className="text-base">→3塁</SelectItem>
                  )}
                  <SelectItem value="home" className="text-base">得点</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={onConfirm}
            disabled={saving || Object.values(selections).every((v) => v === "stay")}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            記録する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
