import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/components/AppShell";
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

const ORG_TYPES = ["Central Govt", "State Govt", "PSU", "Private", "Other"] as const;

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
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [state, setState] = useState("");
  const [orgType, setOrgType] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setDepartment(profile.department ?? "");
      setDesignation(profile.designation ?? "");
      setState(profile.state ?? "");
      setOrgType(profile.org_type ?? "");
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
        phone: phone.trim().slice(0, 20) || null,
        department: department.trim().slice(0, 120) || null,
        designation: designation.trim().slice(0, 120) || null,
        state: state || null,
        org_type: orgType || null,
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
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
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
        <div className="space-y-1.5">
          <Label htmlFor="desig">Designation</Label>
          <Input
            id="desig"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="space-y-1.5">
          <Label>State</Label>
          <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={60} />
        </div>
        <div className="space-y-1.5">
          <Label>Organisation type</Label>
          <Select value={orgType} onValueChange={setOrgType}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {ORG_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={save} disabled={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
