import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateFormalTitle } from "@/lib/vision.functions";
import { Loader2, Sparkles, Upload, PenLine, FileUp, Mic, Camera } from "lucide-react";
import { VoiceRecorder, CameraCapture } from "@/components/CaptureInputs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } =>
    ["manual", "file", "voice", "camera"].includes(s["mode"] as string)
      ? { mode: s["mode"] as Mode }
      : {},
  component: NewProcurement,
});

type Mode = "manual" | "file" | "voice" | "camera";
const modes: { mode: Mode; label: string; icon: typeof PenLine }[] = [
  { mode: "manual", label: "Manual Form", icon: PenLine },
  { mode: "file", label: "Text File", icon: FileUp },
  { mode: "voice", label: "Voice", icon: Mic },
  { mode: "camera", label: "Camera", icon: Camera },
];

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
  const mode: Mode = Route.useSearch().mode ?? "manual";
  const [missing, setMissing] = useState<string[] | null>(null);
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
  const [titling, setTitling] = useState(false);
  const makeTitle = useServerFn(generateFormalTitle);

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
    let text = "";
    if (/\.(txt|md|csv)$/i.test(file.name)) {
      text = await file.text();
    } else if (/\.docx$/i.test(file.name)) {
      try {
        const mammoth = await import("mammoth");
        const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        text = res.value.replace(/\n{3,}/g, "\n\n").trim();
      } catch {
        toast.error("Could not read this Word file. It may be damaged or password-protected.");
        return;
      }
    } else if (/\.doc$/i.test(file.name)) {
      toast.info("Old .doc files can't be read. Please save it as .docx in Word and upload again.");
      return;
    } else {
      toast.info("For PDF files, paste the specification text into the description box.");
      return;
    }
    if (!text) {
      toast.info("No text was found in this file.");
      return;
    }
    const firstLine = text.split("\n").find((l) => l.trim())?.trim().slice(0, 80) ?? "";
    setForm((f) => ({
      ...f,
      title: f.title || firstLine,
      description: `${f.description}\n\n--- From ${file.name} ---\n${text}`.trim().slice(0, 6000),
    }));
    toast.success("Specification text added from the document.");
  }

  function appendText(text: string, label: string) {
    setForm((f) => ({
      ...f,
      description: `${f.description}\n\n--- ${label} ---\n${text}`.trim().slice(0, 6000),
    }));
    if (!form.title.trim()) {
      setTitling(true);
      makeTitle({ data: { text } })
        .then(({ title }) => setForm((f) => (f.title.trim() ? f : { ...f, title })))
        .catch(() => toast.info("Could not suggest a title — please type one."))
        .finally(() => setTitling(false));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const gaps: string[] = [];
    if (form.title.trim().length < 3) gaps.push("Procurement title");
    if (form.description.trim().length < 40) gaps.push("Detailed description / specification");
    if (!form.quantity.trim()) gaps.push("Quantity");
    if (form.application === "Other") gaps.push("Specific use / application");
    if (gaps.length) {
      setMissing(gaps);
      return;
    }
    void save("In Progress");
  }

  async function save(status: "In Progress" | "Withdrawn" | "Rejected") {
    setMissing(null);
    const parsed = schema.safeParse({
      ...form,
      title: form.title.trim().length >= 3 ? form.title : "Untitled procurement",
      description:
        status === "In Progress" ? form.description : form.description.padEnd(15, " ").trim() || "Specification not provided",
    });
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
        .insert({
          ...parsed.data,
          user_id: auth.user.id,
          input_mode: mode,
          status,
          review_note: status === "In Progress" ? null : "Missing specification details",
          reviewed_at: status === "In Progress" ? null : new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      if (status === "In Progress") navigate({ to: "/procurement/$id", params: { id: data.id } });
      else {
        toast.success(`Procurement ${status.toLowerCase()}.`);
        navigate({ to: "/history" });
      }
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

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {modes.map(({ mode: m, label, icon: Icon }) => (
          <Button
            key={m}
            type="button"
            variant={mode === m ? "default" : "outline"}
            onClick={() => navigate({ to: "/new-procurement", search: { mode: m } })}
          >
            <Icon className="mr-2 h-4 w-4" /> {label}
          </Button>
        ))}
      </div>

      {mode === "voice" && (
        <div className="mt-4 rounded-xl border border-border bg-card p-6 shadow-card">
          <VoiceRecorder
            language={form.language}
            onLanguage={(l) => set("language", l)}
            onTranscript={(orig, en) =>
              appendText(orig === en ? orig : `${orig}\n(English: ${en})`, "Voice input")
            }
          />
        </div>
      )}
      {mode === "camera" && (
        <div className="mt-4 rounded-xl border border-border bg-card p-6 shadow-card">
          <CameraCapture onExtract={(t) => appendText(t, "From photo")} />
        </div>
      )}
      {mode === "file" && (
        <p className="mt-4 text-sm text-muted-foreground">
          Upload your specification file below — its text fills the description automatically.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5 rounded-xl border border-border bg-card p-6 shadow-card"
      >
        <div className="space-y-1.5">
          <Label htmlFor="title">
            Procurement Title *{" "}
            {titling && (
              <span className="ml-2 inline-flex items-center text-xs font-normal text-muted-foreground">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Writing a formal title…
              </span>
            )}
          </Label>
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

      <AlertDialog open={!!missing} onOpenChange={(o) => !o && setMissing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Some specification details are missing</AlertDialogTitle>
            <AlertDialogDescription>
              The following are missing or too brief: {missing?.join(", ")}. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setMissing(null)}>Fill details</Button>
            <Button variant="outline" onClick={() => save("Withdrawn")}>Withdraw</Button>
            <Button variant="destructive" onClick={() => save("Rejected")}>Reject</Button>
            <Button onClick={() => save("In Progress")}>Accept &amp; analyze anyway</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
