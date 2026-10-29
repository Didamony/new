import type { GenerateContentResponse } from "@google/genai";
import { refreshAccess, supabase } from "./account";
import { AiError, systemPrompt } from "./ai-common";
import { buildContents, checkFinish, toGeminiSchema } from "./gemini";
import type { ChatMsg, Material } from "./types";

/*
 * Built-in free AI: requests go through our `ai-proxy` function, which uses the
 * owner's Gemini key and spends one request of the student's daily allowance.
 */

const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`;

async function call(body: Record<string, unknown>, signal?: AbortSignal) {
  const { data } = await supabase!.auth.getSession();
  if (!data.session) throw new AiError("auth");
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    throw signal?.aborted ? new AiError("aborted") : new AiError("network");
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    if (err.error === "quota") throw new AiError("quota");
    if (err.error === "no-access") throw new AiError("permission");
    if (err.error === "too-large") throw new AiError("truncated");
    if (res.status >= 500) throw new AiError("overloaded");
    throw new AiError("unknown", err.error ?? String(res.status));
  }
  return res;
}

/** Text of one Gemini response chunk, skipping the model's internal "thought" parts. */
function textOf(r: GenerateContentResponse) {
  return (r.candidates?.[0]?.content?.parts ?? []).map((p) => (p.thought ? "" : (p.text ?? ""))).join("");
}

export async function streamText(opts: {
  material?: Material;
  task: string;
  history?: ChatMsg[];
  onText: (full: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const res = await call({ mode: "stream", system: systemPrompt(opts.material), contents: buildContents(opts.material, opts.task, opts.history) }, opts.signal);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  let last: GenerateContentResponse | undefined;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // server-sent events: blank line between events, payload on "data:" lines
      const events = buf.split(/\r?\n\r?\n/);
      buf = events.pop() ?? "";
      for (const ev of events) {
        const payload = ev
          .split(/\r?\n/)
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("");
        if (!payload) continue;
        last = JSON.parse(payload) as GenerateContentResponse;
        const delta = textOf(last);
        if (delta) {
          full += delta;
          opts.onText(full);
        }
      }
    }
  } catch (e) {
    if (opts.signal?.aborted) throw new AiError("aborted");
    throw e instanceof AiError ? e : new AiError("network");
  } finally {
    refreshAccess(); // updates the "requests left today" counter
  }
  if (!full) checkFinish(last);
  return full;
}

export async function runJson<T>(opts: { material: Material; task: string; schema: Record<string, unknown>; signal?: AbortSignal }): Promise<T> {
  const res = await call(
    { mode: "json", system: systemPrompt(opts.material), contents: buildContents(opts.material, opts.task), schema: toGeminiSchema(opts.schema) },
    opts.signal,
  );
  refreshAccess();
  const data = (await res.json()) as GenerateContentResponse;
  checkFinish(data);
  try {
    return JSON.parse(textOf(data)) as T;
  } catch {
    throw new AiError("bad-output");
  }
}
