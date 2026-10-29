import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlockParam, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AiError, materialTextBlock, systemPrompt } from "./ai-common";
import { DEMO, demoJson, demoStream } from "./demo";
import { billingEnabled } from "./account";
import * as freeai from "./freeai";
import * as gemini from "./gemini";
import { getSettings } from "./store";
import type { ChatMsg, Material, ModelId } from "./types";

export { AiError, type AiErrorCode } from "./ai-common";

/** The built-in free AI needs accounts (Supabase); without them, fall back to the student's own Gemini key. */
export function activeProvider() {
  const { provider } = getSettings();
  return provider === "free" && !billingEnabled ? "gemini" : provider;
}

export const MODELS: { id: ModelId; tier: "best" | "balanced" | "cheap" }[] = [
  { id: "claude-opus-5-5", tier: "best" },
  { id: "claude-sonnet-5-5", tier: "balanced" },
  { id: "claude-haiku-5-5", tier: "cheap" },
];

function client() {
  const { apiKey } = getSettings();
  if (!apiKey.trim()) throw new AiError("no-key");
  // The key belongs to the student and never leaves their device except to Anthropic.
  return new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 2 });
}

/** Model-specific request options: refusal fallbacks are only available on Opus/Sonnet. */
function modelParams(model: ModelId) {
  const base = { model, output_config: { effort: "medium" as const } };
  if (model === "claude-haiku-5-5") return { ...base, betas: [] as string[] };
  return { ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
}

function materialBlocks(m: Material): BetaContentBlockParam[] {
  const blocks: BetaContentBlockParam[] = [];
  if (m.images?.length) {
    m.images.forEach((img, i) => {
      blocks.push({ type: "text", text: `Page ${i + 1}:` });
      blocks.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
    });
  }
  if (m.text) {
    blocks.push({ type: "text", text: materialTextBlock(m) });
  }
  // Cache the material so every further tool on it is cheaper and faster.
  const last = blocks[blocks.length - 1] as { cache_control?: { type: "ephemeral" } };
  if (last) last.cache_control = { type: "ephemeral" };
  return blocks;
}

function mapError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.APIUserAbortError) return new AiError("aborted");
  if (e instanceof Anthropic.AuthenticationError) return new AiError("auth");
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError("permission");
  if (e instanceof Anthropic.RateLimitError) return new AiError("rate");
  if (e instanceof Anthropic.APIConnectionError) return new AiError("network");
  if (e instanceof Anthropic.APIError) {
    const msg = String(e.message ?? "");
    if (/credit balance|billing/i.test(msg)) return new AiError("credits", msg);
    if (e.status === 529 || e.status === 503 || (e.status ?? 0) >= 500) return new AiError("overloaded", msg);
    return new AiError("unknown", msg);
  }
  if (e instanceof DOMException && e.name === "AbortError") return new AiError("aborted");
  return new AiError("unknown", e instanceof Error ? e.message : String(e));
}

function buildMessages(material: Material | undefined, task: string, history: ChatMsg[] = []): BetaMessageParam[] {
  const first: BetaContentBlockParam[] = material ? materialBlocks(material) : [];
  if (history.length === 0) {
    return [{ role: "user", content: [...first, { type: "text", text: task }] }];
  }
  // Chat: material + first question in the first turn, then the conversation as-is.
  const [head, ...rest] = history;
  return [
    { role: "user", content: [...first, { type: "text", text: head.content }] },
    ...rest.map((m) => ({ role: m.role, content: m.content })),
  ];
}

export interface StreamOpts {
  material?: Material;
  task: string;
  history?: ChatMsg[];
  onText: (full: string) => void;
  signal?: AbortSignal;
}

/** Streams a Markdown answer from the student's chosen provider; resolves with the full text. */
export function streamText(opts: StreamOpts): Promise<string> {
  if (DEMO) return demoStream(opts).catch((e) => Promise.reject(e instanceof DOMException ? new AiError("aborted") : e));
  const p = activeProvider();
  return p === "free" ? freeai.streamText(opts) : p === "gemini" ? gemini.streamText(opts) : claudeStreamText(opts);
}

async function claudeStreamText({ material, task, history, onText, signal }: StreamOpts): Promise<string> {
  try {
    const { model } = getSettings();
    const stream = client().beta.messages.stream(
      {
        ...modelParams(model),
        max_tokens: 64000,
        system: systemPrompt(material),
        messages: buildMessages(material, task, history),
      },
      { signal },
    );
    let full = "";
    stream.on("text", (delta) => {
      full += delta;
      onText(full);
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new AiError("refusal");
    return full;
  } catch (e) {
    throw mapError(e);
  }
}

export interface JsonOpts {
  material: Material;
  task: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}

/** Runs a task whose answer must match `schema` (structured outputs). */
export function runJson<T>(opts: JsonOpts): Promise<T> {
  if (DEMO) return demoJson<T>(opts.schema, opts.signal).catch((e) => Promise.reject(e instanceof DOMException ? new AiError("aborted") : e));
  const p = activeProvider();
  return p === "free" ? freeai.runJson<T>(opts) : p === "gemini" ? gemini.runJson<T>(opts) : claudeRunJson<T>(opts);
}

async function claudeRunJson<T>({ material, task, schema, signal }: JsonOpts): Promise<T> {
  try {
    const { model } = getSettings();
    const params = modelParams(model);
    const stream = client().beta.messages.stream(
      {
        ...params,
        output_config: { ...params.output_config, format: { type: "json_schema", schema } },
        max_tokens: 64000,
        system: systemPrompt(material),
        messages: buildMessages(material, task),
      },
      { signal },
    );
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new AiError("refusal");
    if (msg.stop_reason === "max_tokens") throw new AiError("truncated");
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new AiError("bad-output");
    }
  } catch (e) {
    throw mapError(e);
  }
}

/** Cheap call used by Settings to check the Claude key works. */
export async function testClaudeKey(): Promise<void> {
  try {
    await client().messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with OK." }],
    });
  } catch (e) {
    throw mapError(e);
  }
}

/* ---------------- prompts & schemas ---------------- */

export type SummaryStyle = "brief" | "detailed" | "bullets" | "exam";
export type Difficulty = "easy" | "medium" | "hard" | "mixed";

export const prompts = {
  summary(style: SummaryStyle) {
    const styles: Record<SummaryStyle, string> = {
      brief: "Write a brief summary (one short intro paragraph + 5–8 key points). Keep it tight.",
      detailed:
        "Write a detailed, well-structured study summary. Use headings for each main topic, explain the key ideas, definitions, causes/effects, examples, and any formulas or dates. Finish with a short 'Remember' box of the most important points.",
      bullets: "Summarise as a hierarchical bullet-point outline that a student can revise from quickly. Bold the key terms.",
      exam: "Write a last-night-before-the-exam revision sheet: the must-know facts, definitions, formulas, dates, common mistakes, and likely exam angles. Very compact.",
    };
    return `Summarise the study material above. ${styles[style]}`;
  },
  explain:
    "Explain the study material above as if to a student who finds it hard: use simple language, everyday analogies, and a worked example for each main idea. Start with a one-sentence 'big picture', then go idea by idea, and end with a quick 3-question self-check (answers hidden under a 'Answers' heading at the end).",
  questions(count: number, difficulty: Difficulty) {
    return `Generate the ${count} questions most likely to appear in an exam on the study material above, with model answers a teacher would accept.
Mix question types (e.g. define, explain, compare, why/how, give an example, short answer, problem-solving where relevant). Difficulty: ${difficulty === "mixed" ? "a mix of easy, medium and hard" : difficulty}.
Each answer should be complete but concise. "type" is a short label for the question type in the answer language.`;
  },
  quiz(count: number, difficulty: Difficulty) {
    return `Create a ${count}-question multiple-choice quiz on the study material above. Difficulty: ${difficulty === "mixed" ? "mixed" : difficulty}.
Each question has 4 plausible options (for true/false questions use exactly 2 options), exactly one correct. Vary the position of the correct answer. "correct_index" is the 0-based index of the correct option. "explanation" briefly says why it is correct.`;
  },
  flashcards(count: number) {
    return `Create ${count} high-quality flashcards for active recall on the study material above. Front: a focused question or term. Back: a short, precise answer (1–3 sentences). Cover the most important ideas first and avoid duplicates.`;
  },
  terms: "Extract the key terms, concepts, people, and formulas from the study material above, each with a clear one- or two-sentence definition as used in the material. Order them as they appear.",
  mindmap:
    "Build a mind map of the study material above: the root is the main topic, with 3–7 main branches, each with sub-points (up to 3 levels deep). Keep each node title short (max ~8 words).",
};

const str = { type: "string" };

export const schemas = {
  questions: {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "answer", "type", "difficulty"],
          properties: {
            question: str,
            answer: str,
            type: str,
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          },
        },
      },
    },
  },
  quiz: {
    type: "object",
    additionalProperties: false,
    required: ["quiz"],
    properties: {
      quiz: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "options", "correct_index", "explanation"],
          properties: {
            question: str,
            options: { type: "array", items: str },
            correct_index: { type: "integer" },
            explanation: str,
          },
        },
      },
    },
  },
  flashcards: {
    type: "object",
    additionalProperties: false,
    required: ["cards"],
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["front", "back"],
          properties: { front: str, back: str },
        },
      },
    },
  },
  terms: {
    type: "object",
    additionalProperties: false,
    required: ["terms"],
    properties: {
      terms: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["term", "definition"],
          properties: { term: str, definition: str },
        },
      },
    },
  },
  // Fixed depth (3 levels) keeps the schema non-recursive.
  mindmap: {
    type: "object",
    additionalProperties: false,
    required: ["title", "children"],
    properties: {
      title: str,
      children: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "children"],
          properties: {
            title: str,
            children: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "children"],
                properties: {
                  title: str,
                  children: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["title"],
                      properties: { title: str },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
