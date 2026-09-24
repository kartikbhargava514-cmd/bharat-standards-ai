import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — BharatStandAI" },
      { name: "description", content: "Manage your officer profile and department details." },
      { property: "og:title", content: "Settings — BharatStandAI" },
      { property: "og:description", content: "Update your BharatStandAI account details." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setDepartment(profile.department);
    }
  }, [profile]);

  async function save() {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again.");
      const { error } = await supabase.from("profiles").upsert({
        id: auth.user.id,
        email: auth.user.email ?? null,
        full_name: fullName.trim().slice(0, 100),
        department: department.trim().slice(0, 120),
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your officer profile and department details.
      </p>

      <div className="mt-6 space-y-4 rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={profile?.email ?? ""} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dept">Department / Organisation</Label>
          <Input
            id="dept"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            maxLength={120}
          />
        </div>
        <Button onClick={save} disabled={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
