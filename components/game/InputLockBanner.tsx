"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Lock, Loader2 } from "lucide-react";
import { useState } from "react";

interface InputLockBannerProps {
  holderName: string;
  isStale: boolean;
  onRequestSession: () => Promise<void>;
}

export function InputLockBanner({
  holderName,
  isStale,
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
        {isStale && (
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
