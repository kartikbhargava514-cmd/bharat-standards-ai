const ENDPOINT = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";
const DRAVIDIAN = ["ta", "te", "kn", "ml"];

function key() {
  const k = process.env["BHASHINI_INFERENCE_KEY"];
  if (!k) throw new Error("Bhashini is not configured.");
  return k;
}

async function call(body: unknown) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: key(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Bhashini error", res.status, text.slice(0, 300));
    throw new Error(`Language service error (${res.status}). Please try again.`);
  }
  const json = (await res.json()) as {
    pipelineResponse?: {
      output?: { source?: string; target?: string }[] | null;
      audio?: { audioContent?: string }[] | null;
    }[];
  };
  return json.pipelineResponse?.[0];
}

export async function bhashiniAsr(audioBase64: string, lang: string) {
  const serviceId =
    lang === "en"
      ? "ai4bharat/whisper-medium-en--gpu--t4"
      : DRAVIDIAN.includes(lang)
        ? "ai4bharat/conformer-multilingual-dravidian-gpu--t4"
        : "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4";
  const r = await call({
    pipelineTasks: [
      {
        taskType: "asr",
        config: { language: { sourceLanguage: lang }, serviceId, audioFormat: "wav", samplingRate: 16000 },
      },
    ],
    inputData: { audio: [{ audioContent: audioBase64 }] },
  });
  return r?.output?.[0]?.source ?? "";
}

export async function bhashiniTranslate(texts: string[], source: string, target: string) {
  if (source === target || !texts.length) return texts;
  const r = await call({
    pipelineTasks: [
      {
        taskType: "translation",
        config: {
          language: { sourceLanguage: source, targetLanguage: target },
          serviceId: "ai4bharat/indictrans-v2-all-gpu--t4",
        },
      },
    ],
    inputData: { input: texts.map((source) => ({ source })) },
  });
  return texts.map((t, i) => r?.output?.[i]?.target ?? t);
}

export async function bhashiniTts(text: string, lang: string) {
  const serviceId =
    lang === "en"
      ? "ai4bharat/indic-tts-coqui-misc-gpu--t4"
      : DRAVIDIAN.includes(lang)
        ? "ai4bharat/indic-tts-coqui-dravidian-gpu--t4"
        : "ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4";
  const r = await call({
    pipelineTasks: [
      {
        taskType: "tts",
        config: { language: { sourceLanguage: lang }, serviceId, gender: "female", samplingRate: 16000 },
      },
    ],
    inputData: { input: [{ source: text }] },
  });
  return r?.audio?.[0]?.audioContent ?? "";
}
