"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GameInputError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const gameId = params?.id as string | undefined;

  useEffect(() => {
    console.error("Game input error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">入力画面でエラーが発生しました</h2>
        <p className="text-muted-foreground text-sm">
          予期しないエラーが発生しました。再試行してください。
        </p>
        <p className="text-muted-foreground text-xs">
          ※ 保存済みのデータは失われません。未保存の入力内容は破棄される場合があります。
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          再試行
        </Button>
        {gameId && (
          <Link href={`/games/${gameId}`}>
            <Button>試合詳細に戻る</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
