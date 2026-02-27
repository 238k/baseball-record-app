"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { updateProfileAction, updateDefaultTeamAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Team {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [defaultTeamId, setDefaultTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamSuccess, setTeamSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, default_team_id")
        .eq("id", user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name);
        setDefaultTeamId(profile.default_team_id);
      }

      const { data: memberships } = await supabase
        .from("team_members")
        .select("teams(id, name)")
        .eq("profile_id", user.id);

      const t = (memberships ?? []).flatMap((m) => {
        if (!m.teams) return [];
        const team = m.teams as { id: string; name: string };
        return [{ id: team.id, name: team.name }];
      });
      setTeams(t);

      setLoading(false);
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const result = await updateProfileAction({ displayName });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(true);
  };

  const handleDefaultTeamChange = async (value: string) => {
    const newTeamId = value;
    setDefaultTeamId(newTeamId);
    setSavingTeam(true);
    setTeamError(null);
    setTeamSuccess(false);

    const result = await updateDefaultTeamAction(newTeamId);

    setSavingTeam(false);

    if (result.error) {
      setTeamError(result.error);
      return;
    }

    setTeamSuccess(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Link
        href="/"
        prefetch={false}
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        トップに戻る
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">プロフィール設定</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">
                表示名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setSuccess(false);
                }}
                placeholder="表示名を入力"
                required
                className="text-lg h-14"
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}
            {success && (
              <p className="text-green-600 text-sm">保存しました</p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full min-h-16 text-lg"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              保存する
            </Button>
          </form>
        </CardContent>
      </Card>

      {teams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">デフォルトチーム</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>チーム選択</Label>
              <Select
                value={defaultTeamId ?? undefined}
                onValueChange={handleDefaultTeamChange}
                disabled={savingTeam}
              >
                <SelectTrigger className="text-lg h-14">
                  <SelectValue placeholder="チームを選択" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-lg">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {savingTeam && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                保存中...
              </div>
            )}
            {teamError && <p className="text-destructive text-sm">{teamError}</p>}
            {teamSuccess && (
              <p className="text-green-600 text-sm">保存しました</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
