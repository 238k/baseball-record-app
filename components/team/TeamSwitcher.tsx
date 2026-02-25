"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Team {
  id: string;
  name: string;
}

interface TeamSwitcherProps {
  teams: Team[];
  currentTeamId: string;
}

export function TeamSwitcher({ teams, currentTeamId }: TeamSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (teams.length <= 1) return null;

  const handleChange = (teamId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("team", teamId);
    router.push(`/teams?${params.toString()}`);
  };

  return (
    <Select value={currentTeamId} onValueChange={handleChange}>
      <SelectTrigger className="text-lg h-14 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {teams.map((t) => (
          <SelectItem key={t.id} value={t.id} className="text-lg">
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
