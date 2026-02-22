"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { forceReleaseSessionAction } from "@/app/(main)/team/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ActiveSession {
  gameId: string;
  opponentName: string;
  gameDate: string;
  holderName: string;
  lastActiveAt: string;
}

interface ActiveSessionsSectionProps {
  teamId: string;
  sessions: ActiveSession[];
}

export function ActiveSessionsSection({ teamId, sessions }: ActiveSessionsSectionProps) {
  const [releasing, setReleasing] = useState<string | null>(null);
  const [localSessions, setLocalSessions] = useState(sessions);

  if (localSessions.length === 0) return null;

  const handleForceRelease = async (gameId: string) => {
    setReleasing(gameId);
    const result = await forceReleaseSessionAction(gameId, teamId);
    setReleasing(null);

    if (!result.error) {
      setLocalSessions((prev) => prev.filter((s) => s.gameId !== gameId));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">入力セッション管理</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {localSessions.map((s) => (
            <div
              key={s.gameId}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  vs {s.opponentName}（{s.gameDate}）
                </p>
                <p className="text-sm text-muted-foreground">
                  入力者: {s.holderName}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={releasing === s.gameId}
                  >
                    {releasing === s.gameId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 h-4 w-4" />
                    )}
                    強制解除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>セッションを強制解除しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      {s.holderName}さんの入力セッションを強制的に解除します。
                      入力中のデータは保持されますが、入力者は操作を続けられなくなります。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleForceRelease(s.gameId)}>
                      強制解除する
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
