"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

interface InputLockBannerProps {
  holderName: string;
  hasPendingRequest: boolean;
  wasRejected: boolean;
  onRequestSession: () => Promise<void>;
}

export function InputLockBanner({
  holderName,
  hasPendingRequest,
  wasRejected,
  onRequestSession,
}: InputLockBannerProps) {
  const [requesting, setRequesting] = useState(false);

  const handleRequest = async () => {
    setRequesting(true);
    await onRequestSession();
    setRequesting(false);
  };

  return (
    <Alert>
      <Lock className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-2">
        <span className="text-base">
          {holderName}さんが入力中です
        </span>
        {hasPendingRequest ? (
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            承認待ち...
          </span>
        ) : wasRejected ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-destructive flex items-center gap-1">
              <XCircle className="h-4 w-4" />
              申請が拒否されました
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRequest}
              disabled={requesting}
            >
              再申請
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            className="min-h-12"
            onClick={handleRequest}
            disabled={requesting}
          >
            {requesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            入力権を申請する
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
