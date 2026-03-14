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

interface UndoConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  undoing: boolean;
  onConfirm: () => void;
}

export function UndoConfirmDialog({
  open,
  onOpenChange,
  undoing,
  onConfirm,
}: UndoConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>直前の打席を取り消しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            直前に記録した打席結果を取り消します。投手成績も元に戻されます。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={undoing}>
            {undoing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            取り消す
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
