"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createTeamAction } from "@/app/(main)/team/actions";

export default function NewTeamPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await createTeamAction(teamName);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (!result.teamId) {
      router.push("/");
      return;
    }

    router.push(`/team/${result.teamId}`);
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Link
        href="/"
        prefetch={false}
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        戻る
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">新しいチームを作成</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">チーム名</Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="例：○○野球部"
                required
                className="text-lg h-14"
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button
              type="submit"
              size="lg"
              className="w-full min-h-16 text-lg"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              チームを作成
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
