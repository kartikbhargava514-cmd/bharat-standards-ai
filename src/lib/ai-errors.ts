/** Await a streamText result part and convert stream failures into a clear message. */
export async function awaitAi<T>(p: PromiseLike<T>, getError: () => unknown): Promise<T> {
  try {
    return await p;
  } catch (e) {
    const err = (getError() ?? e) as { statusCode?: number; message?: string; responseBody?: string };
    const msg = `${err?.message ?? ""} ${err?.responseBody ?? ""}`;
    console.error("AI error", err?.statusCode, msg.slice(0, 300));
    if (err?.statusCode === 401 || err?.statusCode === 403 || /API key not valid/i.test(msg))
      throw new Error("Your Gemini key was rejected. Please update it.");
    if (err?.statusCode === 429) throw new Error("Gemini limit reached right now. Please try again shortly.");
    if (err?.statusCode === 503 || /high demand|UNAVAILABLE/i.test(msg))
      throw new Error("Google's Gemini service is busy right now. Please try again in a minute.");
    if (err?.statusCode === 404) throw new Error("The configured Gemini model is not available for this key.");
    throw new Error("The AI service could not complete this request. Please try again.");
  }
}
