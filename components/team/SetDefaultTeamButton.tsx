"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateDefaultTeamAction } from "@/app/(main)/settings/actions";
import { Button } from "@/components/ui/button";
import { Loader2, Star } from "lucide-react";

interface SetDefaultTeamButtonProps {
  teamId: string;
}

export function SetDefaultTeamButton({ teamId }: SetDefaultTeamButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const result = await updateDefaultTeamAction(teamId);
    setLoading(false);

    if (!result.error) {
      router.refresh();
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <Star className="mr-1 h-4 w-4" />
      )}
      デフォルトに設定
    </Button>
  );
}
