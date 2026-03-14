"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface FinishGameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finishing: boolean;
  onConfirm: () => void;
}

export function FinishGameDialog({
  open,
  onOpenChange,
  finishing,
  onConfirm,
}: FinishGameDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>試合を終了しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            試合ステータスが「終了」に変更されます。この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={finishing}>
            {finishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            終了する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
