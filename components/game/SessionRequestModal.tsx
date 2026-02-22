"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface SessionRequestModalProps {
  requesterName: string;
  requestId: string;
  requestCreatedAt: string;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}

export function SessionRequestModal({
  requesterName,
  requestId,
  requestCreatedAt,
  onApprove,
  onReject,
}: SessionRequestModalProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - new Date(requestCreatedAt).getTime();
      const remaining = Math.max(0, Math.ceil((60_000 - elapsed) / 1000));
      setRemainingSeconds(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [requestCreatedAt]);

  const handleApprove = async () => {
    setApproving(true);
    await onApprove(requestId);
    setApproving(false);
  };

  const handleReject = async () => {
    setRejecting(true);
    await onReject(requestId);
    setRejecting(false);
  };

  return (
    <Dialog open>
      <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>入力権の申請</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-base">
            {requesterName}さんが入力権を申請しています
          </p>
          <p className="text-sm text-muted-foreground">
            残り: {remainingSeconds}秒（無応答で自動承認）
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="lg"
            className="min-h-12"
            onClick={handleReject}
            disabled={rejecting || approving}
          >
            {rejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            断る
          </Button>
          <Button
            size="lg"
            className="min-h-12"
            onClick={handleApprove}
            disabled={approving || rejecting}
          >
            {approving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            承認する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
