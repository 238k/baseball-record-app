"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteGameAction, startGameAction } from "@/app/(main)/games/actions";
import { Button } from "@/components/ui/button";
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
import { Loader2, Play, Trash2 } from "lucide-react";

interface GameActionButtonsProps {
  gameId: string;
  hasLineup: boolean;
}

export function GameActionButtons({ gameId, hasLineup }: GameActionButtonsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteGameAction(gameId);
    if (result.error) {
      setError(result.error);
      setDeleting(false);
      return;
    }
    router.push("/");
  };

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    const result = await startGameAction(gameId);
    if (result.error) {
      setError(result.error);
      setStarting(false);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {hasLineup && (
          <Button
            size="lg"
            className="flex-1 min-h-16 text-lg bg-green-600 hover:bg-green-700"
            disabled={starting}
            onClick={handleStart}
          >
            {starting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Play className="mr-2 h-5 w-5" />
            )}
            試合開始
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="lg"
              variant="destructive"
              className={hasLineup ? "min-h-16 text-lg" : "flex-1 min-h-16 text-lg"}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-5 w-5" />
              )}
              削除
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>試合を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この試合とオーダーなどの関連データがすべて削除されます。この操作は取り消せません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                削除する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {error && <p className="text-destructive text-sm text-center">{error}</p>}
    </div>
  );
}
