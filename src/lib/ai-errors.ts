/** Await a streamText result part and convert stream failures into a clear message. */
export async function awaitAi<T>(p: PromiseLike<T>, getError: () => unknown): Promise<T> {
  try {
    return await p;
  } catch (e) {
    const err = (getError() ?? e) as { statusCode?: number; message?: string; responseBody?: string };
    const msg = `${err?.message ?? ""} ${err?.responseBody ?? ""}`;
    console.error("AI error", err?.statusCode, msg.slice(0, 300));
    if (err?.statusCode === 402) throw new Error("AI credits have run out. Please add credits and try again.");
    if (err?.statusCode === 429) throw new Error("The AI service is busy right now. Please try again shortly.");
    throw new Error("The AI service could not complete this request. Please try again.");
  }
}
