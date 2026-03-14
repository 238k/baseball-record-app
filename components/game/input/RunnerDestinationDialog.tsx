"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RunnerDestinationDiamond } from "@/components/field/RunnerDestinationDiamond";
import { Loader2 } from "lucide-react";
import type { RunnerDest, RunnerRow } from "@/app/(main)/games/[id]/input/types";
import type { BaseRunners } from "@/hooks/useGameState";
import { getDestOptionsForBase, isRunnerForced } from "@/lib/game/runner-logic";

interface RunnerDestinationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingResult: { code: string; label: string } | null;
  runnerRows: RunnerRow[];
  batterLineupId: string;
  batterName: string;
  batterDest: RunnerDest;
  baseRunners: BaseRunners;
  lastResultCode: string;
  saving: boolean;
  onRunnerDestChange: (lineupId: string, dest: RunnerDest) => void;
  onBatterDestChange: (dest: RunnerDest) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function RunnerDestinationDialog({
  open,
  onOpenChange,
  pendingResult,
  runnerRows,
  batterLineupId,
  batterName,
  batterDest,
  baseRunners,
  lastResultCode,
  saving,
  onRunnerDestChange,
  onBatterDestChange,
  onSave,
  onCancel,
}: RunnerDestinationDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) onCancel();
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>走者・得点入力</DialogTitle>
        </DialogHeader>

        {pendingResult && (
          <div className="bg-muted rounded-lg px-3 py-2 text-sm">
            <span className="text-muted-foreground">打席結果: </span>
            <span className="font-bold">{pendingResult.label}</span>
          </div>
        )}

        <div className="space-y-4">
          <RunnerDestinationDiamond
            runnerRows={runnerRows}
            batter={{
              lineupId: batterLineupId,
              playerName: batterName,
              destination: batterDest,
            }}
            getDestOptions={(fromBase) =>
              getDestOptionsForBase(fromBase, {
                forceAdvance:
                  fromBase !== "batter" &&
                  isRunnerForced(fromBase as "1st" | "2nd" | "3rd", lastResultCode, baseRunners),
              }).map((o) => o.value)
            }
            onRunnerDestChange={onRunnerDestChange}
            onBatterDestChange={onBatterDestChange}
            className="w-full max-w-[320px] mx-auto"
          />

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-blue-600" /> 走者
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-600" /> 打者
            </span>
            <span>タップで選択→移動先をタップ</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            確定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
