import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { BookOpenCheck, Loader2, Mic, Plus, Send, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { sendAssistantMessage } from "@/lib/assistant.functions";
import { speechToText } from "@/lib/bhashini.functions";
import { startWavRecording } from "@/lib/wav";
import { useLang } from "@/lib/i18n";
import { SpeakButton } from "@/components/LanguageTools";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: string; content: string };

export function AssistantChat({
  threadId,
  onThreadChange,
  suggestions,
}: {
  threadId: string | null;
  onThreadChange: (id: string | null) => void;
  suggestions: string[];
}) {
  const qc = useQueryClient();
  const send = useServerFn(sendAssistantMessage);
  const stt = useServerFn(speechToText);
  const { lang } = useLang();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [rec, setRec] = useState<"idle" | "recording" | "processing">("idle");
  const stopRef = useRef<null | (() => Promise<string>)>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: threads } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_threads")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["chat-messages", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, role, content")
        .eq("thread_id", threadId!)
        .order("created_at");
      return (data ?? []) as Msg[];
    },
  });

  const shown: Msg[] = [
    ...(threadId ? (messages ?? []) : []),
    ...(pending ? [{ id: "pending", role: "user", content: pending }] : []),
  ];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [shown.length]);
  useEffect(() => {
    taRef.current?.focus();
  }, [threadId]);

  async function submit(text: string) {
    const msg = text.trim();
    if (!msg || pending) return;
    setInput("");
    setPending(msg);
    try {
      const res = await send({ data: { threadId, message: msg } });
      await qc.invalidateQueries({ queryKey: ["chat-messages", res.threadId] });
      await qc.invalidateQueries({ queryKey: ["chat-threads"] });
      if (res.threadId !== threadId) onThreadChange(res.threadId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The assistant could not reply.");
      setInput(msg);
    } finally {
      setPending(null);
      taRef.current?.focus();
    }
  }

  async function toggleMic() {
    if (rec === "recording") {
      const s = stopRef.current;
      stopRef.current = null;
      if (!s) return;
      setRec("processing");
      try {
        const audio = await s();
        const { text } = await stt({ data: { audio, language: lang } });
        if (text) setInput((v) => `${v} ${text}`.trim());
        else toast.info("No speech detected. Please try again.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not transcribe audio.");
      } finally {
        setRec("idle");
        taRef.current?.focus();
      }
      return;
    }
    try {
      stopRef.current = await startWavRecording();
      setRec("recording");
    } catch {
      toast.error("Microphone access was blocked. Allow it in your browser and try again.");
    }
  }

  async function removeThread(id: string) {
    await supabase.from("chat_threads").delete().eq("id", id);
    await qc.invalidateQueries({ queryKey: ["chat-threads"] });
    if (id === threadId) onThreadChange(null);
  }

  return (
    <div className="grid overflow-hidden rounded-xl border border-border bg-card shadow-card md:grid-cols-[200px_1fr]">
      <aside className="border-b border-border bg-muted/40 p-3 md:border-r md:border-b-0">
        <Button size="sm" variant="outline" className="w-full" onClick={() => onThreadChange(null)}>
          <Plus className="mr-1 h-4 w-4" /> New chat
        </Button>
        <div className="mt-3 max-h-40 space-y-1 overflow-y-auto md:max-h-[420px]">
          {threads?.map((t) => (
            <div
              key={t.id}
              className={cn(
                "group flex items-center rounded-md text-sm",
                t.id === threadId ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
              )}
            >
              <button className="flex-1 truncate px-2 py-1.5 text-left" onClick={() => onThreadChange(t.id)}>
                {t.title}
              </button>
              <button
                aria-label="Delete chat"
                className="p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                onClick={() => removeThread(t.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-h-[420px] flex-col">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <BookOpenCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold">Mitra — Standards Assistant</p>
            <p className="text-xs text-muted-foreground">Ask about any standard or how to use the app.</p>
          </div>
        </div>

        <div className="max-h-[480px] flex-1 space-y-4 overflow-y-auto p-4">
          {!shown.length && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-md bg-muted px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {shown.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                {m.content}
              </div>
            ) : (
              <div key={m.id} className="space-y-2">
                <div className="prose prose-sm max-w-none text-foreground">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
                <SpeakButton text={m.content.replace(/[*#_`>-]/g, "")} />
              </div>
            ),
          )}
          {pending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Mitra is thinking…
            </p>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
        >
          <Button
            type="button"
            size="icon"
            variant={rec === "recording" ? "destructive" : "outline"}
            onClick={toggleMic}
            disabled={rec === "processing"}
            aria-label={rec === "recording" ? "Stop recording" : "Speak your question"}
          >
            {rec === "processing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : rec === "recording" ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          <Textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(input);
              }
            }}
            placeholder={rec === "recording" ? "Listening… tap stop when done" : "Ask about a standard, e.g. Explain IS 277"}
            rows={1}
            maxLength={4000}
            className="min-h-10 resize-none"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || !!pending} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
