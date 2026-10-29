import { getSettings } from "./store";
import type { Material } from "./types";

/* Shared by every AI provider. */

export type AiErrorCode =
  | "no-key"
  | "auth"
  | "permission"
  | "credits"
  | "rate"
  | "overloaded"
  | "network"
  | "refusal"
  | "truncated"
  | "bad-output"
  | "aborted"
  | "unknown";

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}

function languageRule(material?: Material) {
  const { outputLang, lang } = getSettings();
  if (outputLang === "ar") return "Always answer in Arabic (Modern Standard Arabic, clear and student-friendly).";
  if (outputLang === "en") return "Always answer in English.";
  return material
    ? "Answer in the same language as the study material. If the material mixes languages, use the dominant one; keep technical terms in their original language when helpful."
    : `Answer in ${lang === "ar" ? "Arabic" : "English"}.`;
}

export function systemPrompt(material?: Material) {
  return [
    "You are Zakerly, a warm, expert study tutor helping a student master their study material.",
    "Base everything on the provided material. If something isn't covered by it, say so briefly before adding general knowledge.",
    "Be accurate, well-organised and encouraging. Use Markdown headings, bullet lists, bold key ideas, and tables when they help.",
    "When the material is images of book pages, read them carefully (including handwriting, tables, and diagrams).",
    languageRule(material),
  ].join("\n");
}

export function materialTextBlock(m: Material) {
  return `<study_material title="${m.title.replace(/"/g, "'")}">\n${m.text}\n</study_material>`;
}
