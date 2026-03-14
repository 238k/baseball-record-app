"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface InningChangeDialogProps {
  open: boolean;
  nextInning: number | null;
  nextHalf: "top" | "bottom" | null;
  onConfirm: () => void;
}

export function InningChangeDialog({
  open,
  nextInning,
  nextHalf,
  onConfirm,
}: InningChangeDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>攻守交代</AlertDialogTitle>
          <AlertDialogDescription>
            3アウトチェンジ。
            {nextInning !== null &&
              nextHalf !== null &&
              `${nextInning}回${nextHalf === "top" ? "表" : "裏"}に進みます。`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onConfirm}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
