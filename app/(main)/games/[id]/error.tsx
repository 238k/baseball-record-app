"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GameDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Game detail error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">試合データの読み込みに失敗しました</h2>
        <p className="text-muted-foreground text-sm">
          試合データの取得中にエラーが発生しました。再試行するか、試合一覧に戻ってください。
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          再試行
        </Button>
        <Link href="/games">
          <Button>試合一覧に戻る</Button>
        </Link>
      </div>
    </div>
  );
}
