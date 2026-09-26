import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Mic, Square, RotateCcw, ImageUp } from "lucide-react";
import { toast } from "sonner";

import { speechToText } from "@/lib/bhashini.functions";
import { extractFromImage } from "@/lib/vision.functions";
import { startWavRecording } from "@/lib/wav";
import { LANGUAGES } from "@/lib/languages";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MAX_SECONDS = 45;

export function VoiceRecorder({
  language,
  onLanguage,
  onTranscript,
}: {
  language: string;
  onLanguage: (l: string) => void;
  onTranscript: (original: string, english: string) => void;
}) {
  const stt = useServerFn(speechToText);
  const stopRef = useRef<null | (() => Promise<string>)>(null);
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => {
    if (state === "recording" && seconds >= MAX_SECONDS) void stop();
  });

  async function start() {
    try {
      stopRef.current = await startWavRecording();
      setSeconds(0);
      setState("recording");
    } catch {
      toast.error("Microphone access was blocked. Allow it in your browser and try again.");
    }
  }

  async function stop() {
    const s = stopRef.current;
    if (!s) return;
    stopRef.current = null;
    setState("processing");
    try {
      const audio = await s();
      const { text, english } = await stt({ data: { audio, language } });
      if (!text) toast.info("No speech detected. Please try again, speaking clearly.");
      else onTranscript(text, english);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not transcribe audio.");
    } finally {
      setState("idle");
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-5">
      <div className="max-w-xs space-y-1.5">
        <Label>Spoken language</Label>
        <Select value={language} onValueChange={onLanguage} disabled={state !== "idle"}>
          <SelectTrigger>
            <SelectValue />
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
      <div className="flex flex-col items-center gap-3 py-2">
        <button
          type="button"
          onClick={state === "recording" ? stop : start}
          disabled={state === "processing"}
          aria-label={state === "recording" ? "Stop recording" : "Start recording"}
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-transform hover:scale-105 disabled:opacity-60",
            state === "recording" ? "animate-pulse bg-destructive" : "bg-primary",
          )}
        >
          {state === "processing" ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : state === "recording" ? (
            <Square className="h-7 w-7" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </button>
        <p className="text-sm text-muted-foreground">
          {state === "recording"
            ? `Recording… ${seconds}s / ${MAX_SECONDS}s — tap to stop`
            : state === "processing"
              ? "Converting your speech to text…"
              : "Tap the microphone and describe what you need to procure"}
        </p>
      </div>
    </div>
  );
}

async function toJpeg(source: CanvasImageSource, w: number, h: number) {
  const scale = Math.min(1, 1280 / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function CameraCapture({ onExtract }: { onExtract: (text: string) => void }) {
  const extract = useServerFn(extractFromImage);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setPhoto(null);
      setLive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      toast.error("Camera access was blocked. You can upload a photo instead.");
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }

  async function snap() {
    const v = videoRef.current;
    if (!v) return;
    const url = await toJpeg(v, v.videoWidth, v.videoHeight);
    closeCamera();
    await analyse(url);
  }

  async function fromFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image.");
      return;
    }
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    await analyse(await toJpeg(img, img.naturalWidth, img.naturalHeight));
  }

  async function analyse(url: string) {
    setPhoto(url);
    setBusy(true);
    try {
      const { text } = await extract({
        data: { image: url.split(",")[1] ?? "", mediaType: "image/jpeg" },
      });
      onExtract(text);
      toast.success("Details read from the photo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-5">
      <div className="overflow-hidden rounded-lg bg-foreground/90">
        {live ? (
          <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
        ) : photo ? (
          <img src={photo} alt="Captured specification" className="max-h-80 w-full object-contain" />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sm text-background/70">
            Photograph a product, label, sample or specification sheet
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {live ? (
          <>
            <Button type="button" onClick={snap}>
              <Camera className="mr-2 h-4 w-4" /> Capture
            </Button>
            <Button type="button" variant="outline" onClick={closeCamera}>
              Cancel
            </Button>
          </>
        ) : (
          <Button type="button" onClick={openCamera} disabled={busy}>
            {photo ? <RotateCcw className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
            {photo ? "Retake" : "Open camera"}
          </Button>
        )}
        <label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
          <ImageUp className="mr-2 h-4 w-4" /> Upload photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => fromFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {busy && (
          <span className="inline-flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading details…
          </span>
        )}
      </div>
    </div>
  );
}
