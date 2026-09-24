import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/new-procurement")({
  head: () => ({
    meta: [
      { title: "New Procurement — BharatStandAI" },
      {
        name: "description",
        content:
          "Describe your product or service and let AI recommend the relevant Indian Standards.",
      },
      { property: "og:title", content: "New Procurement — BharatStandAI" },
      {
        property: "og:description",
        content: "Enter a specification and get semantically matched Indian Standards.",
      },
    ],
  }),
  component: NewProcurement,
});

const schema = z.object({
  title: z.string().trim().min(3, "Enter a procurement title").max(160),
  description: z.string().trim().min(15, "Describe the product or service in more detail").max(6000),
  quantity: z.string().trim().max(30),
  unit: z.string().trim().max(40),
  application: z.string().trim().max(80),
  language: z.string(),
});

const units = ["Nos", "Sheets", "Metres", "Kg", "Tonnes", "Litres", "Sets", "Rolls"];
const applications = [
  "Construction",
  "Electrical Installation",
  "Water Supply",
  "Healthcare",
  "Road & Highway",
  "Industrial",
  "Other",
];
const languages = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
  { value: "bn", label: "বাংলা (Bengali)" },
  { value: "ta", label: "தமிழ் (Tamil)" },
  { value: "te", label: "తెలుగు (Telugu)" },
  { value: "mr", label: "मराठी (Marathi)" },
];

function NewProcurement() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    quantity: "",
    unit: "Nos",
    application: "Construction",
    language: "en",
  });
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    if (file.size > 2_000_000) {
      toast.error("File is too large. Please keep it under 2 MB.");
      return;
    }
    if (/\.(txt|md|csv)$/i.test(file.name)) {
      const text = await file.text();
      setForm((f) => ({
        ...f,
        description: `${f.description}\n\n--- From ${file.name} ---\n${text}`.trim().slice(0, 6000),
      }));
      toast.success("Specification text added from the document.");
    } else {
      toast.info("For PDF or DOC files, paste the specification text into the description box.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again.");
      const { data, error } = await supabase
        .from("procurements")
        .insert({ ...parsed.data, user_id: auth.user.id })
        .select("id")
        .single();
      if (error) throw error;
      navigate({ to: "/procurement/$id", params: { id: data.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the procurement.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold">New Procurement</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Provide details about your product or service and let AI recommend the relevant Indian
        Standards.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5 rounded-xl border border-border bg-card p-6 shadow-card"
      >
        <div className="space-y-1.5">
          <Label htmlFor="title">Procurement Title *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Galvanized Roofing Sheets for Warehouse"
            maxLength={160}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Product / Service Description *</Label>
          <Textarea
            id="description"
            rows={5}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Durable, corrosion-resistant, waterproof, heavy-duty, suitable for outdoor warehouse use."
            maxLength={6000}
          />
          <p className="text-xs text-muted-foreground">
            Natural language in English or an Indian language is supported.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              placeholder="200"
              maxLength={30}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Application / Use</Label>
            <Select value={form.application} onValueChange={(v) => set("application", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {applications.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Input Language</Label>
            <Select value={form.language} onValueChange={(v) => set("language", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Upload Specification Document (Optional)</Label>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center transition-colors hover:bg-muted">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">
              {fileName ?? "Drag & drop a file or click to browse"}
            </span>
            <span className="text-xs text-muted-foreground">
              Text files are read automatically. Max 2 MB.
            </span>
            <input
              type="file"
              className="hidden"
              accept=".txt,.md,.csv,.pdf,.doc,.docx"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Analyze with AI
          </Button>
        </div>
      </form>
    </div>
  );
}
