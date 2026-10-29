import { ApiError, GoogleGenAI, type Content, type GenerateContentResponse, type Part } from "@google/genai";
import { AiError, materialTextBlock, systemPrompt } from "./ai-common";
import { getSettings } from "./store";
import type { ChatMsg, Material } from "./types";

/** Used until the student picks a model from the list their key can access. */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function client(apiKey = getSettings().geminiKey) {
  if (!apiKey.trim()) throw new AiError("no-key");
  // The key belongs to the student and is sent only to Google.
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

function model() {
  return getSettings().geminiModel || DEFAULT_GEMINI_MODEL;
}

function materialParts(m: Material): Part[] {
  const parts: Part[] = [];
  m.images?.forEach((img, i) => {
    parts.push({ text: `Page ${i + 1}:` });
    parts.push({ inlineData: { mimeType: img.mediaType, data: img.data } });
  });
  if (m.text) parts.push({ text: materialTextBlock(m) });
  return parts;
}

function buildContents(material: Material | undefined, task: string, history: ChatMsg[] = []): Content[] {
  const first = material ? materialParts(material) : [];
  if (history.length === 0) return [{ role: "user", parts: [...first, { text: task }] }];
  const [head, ...rest] = history;
  return [
    { role: "user", parts: [...first, { text: head.content }] },
    ...rest.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
  ];
}

function mapError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof DOMException && e.name === "AbortError") return new AiError("aborted");
  if (e instanceof ApiError) {
    const msg = String(e.message ?? "");
    if (/API key not valid|API_KEY_INVALID|API key expired/i.test(msg) || e.status === 401) return new AiError("auth");
    if (e.status === 403) return new AiError("permission", msg);
    if (e.status === 429) return new AiError("rate", msg);
    if (e.status >= 500) return new AiError("overloaded", msg);
    return new AiError("unknown", msg);
  }
  if (e instanceof TypeError) return new AiError("network");
  return new AiError("unknown", e instanceof Error ? e.message : String(e));
}

/** Throws the matching AiError when Gemini blocked or cut off the answer. */
function checkFinish(last: GenerateContentResponse | undefined) {
  if (last?.promptFeedback?.blockReason) throw new AiError("refusal");
  const reason = last?.candidates?.[0]?.finishReason;
  if (reason === "SAFETY" || reason === "PROHIBITED_CONTENT" || reason === "BLOCKLIST" || reason === "SPII") throw new AiError("refusal");
  if (reason === "MAX_TOKENS") throw new AiError("truncated");
}

/** Gemini's JSON-schema mode accepts a subset of JSON Schema; drop keywords it may reject. */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema)) if (k !== "additionalProperties") out[k] = toGeminiSchema(v);
    return out;
  }
  return schema;
}

export async function streamText(opts: {
  material?: Material;
  task: string;
  history?: ChatMsg[];
  onText: (full: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  try {
    const stream = await client().models.generateContentStream({
      model: model(),
      contents: buildContents(opts.material, opts.task, opts.history),
      config: { systemInstruction: systemPrompt(opts.material), abortSignal: opts.signal },
    });
    let full = "";
    let last: GenerateContentResponse | undefined;
    for await (const chunk of stream) {
      if (opts.signal?.aborted) throw new AiError("aborted");
      last = chunk;
      const delta = chunk.text;
      if (delta) {
        full += delta;
        opts.onText(full);
      }
    }
    // a cut-off answer is still useful as text; only a block with no text is an error
    if (!full) checkFinish(last);
    return full;
  } catch (e) {
    throw opts.signal?.aborted ? new AiError("aborted") : mapError(e);
  }
}

export async function runJson<T>(opts: { material: Material; task: string; schema: Record<string, unknown>; signal?: AbortSignal }): Promise<T> {
  try {
    const res = await client().models.generateContent({
      model: model(),
      contents: buildContents(opts.material, opts.task),
      config: {
        systemInstruction: systemPrompt(opts.material),
        responseMimeType: "application/json",
        responseJsonSchema: toGeminiSchema(opts.schema),
        abortSignal: opts.signal,
      },
    });
    checkFinish(res);
    try {
      return JSON.parse(res.text ?? "") as T;
    } catch {
      throw new AiError("bad-output");
    }
  } catch (e) {
    throw opts.signal?.aborted ? new AiError("aborted") : mapError(e);
  }
}

export interface GeminiModel {
  id: string;
  name: string;
}

/**
 * Lists the text models this key can use, best first: stable before preview,
 * newer before older, and "flash" first because it has the most generous free limits.
 */
export async function listModels(apiKey?: string): Promise<GeminiModel[]> {
  try {
    const out: GeminiModel[] = [];
    for await (const m of await client(apiKey).models.list({ config: { pageSize: 100 } })) {
      const id = (m.name ?? "").replace(/^models\//, "");
      if (!/^gemini-/.test(id) || !m.supportedActions?.includes("generateContent")) continue;
      if (/image|tts|audio|live|embedding|robotics|computer-use|nano|-exp/.test(id)) continue;
      out.push({ id, name: m.displayName || id });
    }
    const version = (id: string) => parseFloat(id.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? "0");
    const rank = (id: string) => (/preview/.test(id) ? 2 : 0) + (/lite/.test(id) ? 1 : 0) + (/-pro/.test(id) ? 0.5 : 0);
    return out.sort((a, b) => version(b.id) - version(a.id) || rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
  } catch (e) {
    throw mapError(e);
  }
}
