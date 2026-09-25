import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Languages, Loader2, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { LANGUAGES } from "@/lib/languages";
import { useLang } from "@/lib/i18n";
import { textToSpeech } from "@/lib/bhashini.functions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

export function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]!;
  return (
    <div data-no-translate>
      <Select value={lang} onValueChange={setLang}>
        <SelectTrigger className="h-9 w-auto gap-2" aria-label="App language">
          <Languages className="h-4 w-4" />
          <span className="hidden text-sm md:inline">{current.label}</span>
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((l) => (
            <SelectItem key={l.code} value={l.code}>
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SpeakButton({ text, label = "Listen" }: { text: string; label?: string }) {
  const { lang } = useLang();
  const tts = useServerFn(textToSpeech);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");

  async function play() {
    if (state === "playing") {
      audioRef.current?.pause();
      setState("idle");
      return;
    }
    setState("loading");
    try {
      const { audio } = await tts({ data: { text: text.slice(0, 1500), language: lang } });
      const el = new Audio(`data:audio/wav;base64,${audio}`);
      audioRef.current = el;
      el.onended = () => setState("idle");
      await el.play();
      setState("playing");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not play audio.");
      setState("idle");
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={play} disabled={!text || state === "loading"}>
      {state === "loading" ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : state === "playing" ? (
        <Square className="mr-2 h-4 w-4" />
      ) : (
        <Volume2 className="mr-2 h-4 w-4" />
      )}
      {state === "playing" ? "Stop" : label}
    </Button>
  );
}
