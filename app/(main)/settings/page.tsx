"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { updateProfileAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name);
      }
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
    </div>
  );
}
