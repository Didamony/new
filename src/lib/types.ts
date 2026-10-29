export type Lang = "ar" | "en";
export type Theme = "light" | "dark" | "system";
export type Provider = "claude" | "gemini";
export type ModelId = "claude-opus-5-5" | "claude-sonnet-5-5" | "claude-haiku-5-5";
export type OutputLang = "auto" | "ar" | "en";

export interface Settings {
  provider: Provider;
  apiKey: string; // Claude
  model: ModelId; // Claude
  geminiKey: string;
  geminiModel: string;
  lang: Lang;
  theme: Theme;
  outputLang: OutputLang;
  dailyGoalMinutes: number;
  focusMinutes: number;
  breakMinutes: number;
  name: string;
}

export interface ImagePart {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  data: string; // base64 without prefix
}

export type SourceKind = "pdf" | "images" | "text";

export interface QAItem {
  question: string;
  answer: string;
  type: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface QuizItem {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface Term {
  term: string;
  definition: string;
}

export interface MindNode {
  title: string;
  children?: MindNode[];
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface Material {
  id: string;
  title: string;
  emoji: string;
  kind: SourceKind;
  createdAt: number;
  updatedAt: number;
  text?: string;
  images?: ImagePart[];
  pageInfo?: string;
  summary?: { style: string; content: string };
  explain?: string;
  questions?: QAItem[];
  quiz?: QuizItem[];
  quizBest?: number;
  terms?: Term[];
  mindmap?: MindNode;
  chat?: ChatMsg[];
}

export interface Flashcard {
  id: string;
  materialId: string;
  front: string;
  back: string;
  // SM-2 scheduling
  ease: number;
  interval: number; // days
  reps: number;
  due: number; // timestamp
  createdAt: number;
}

export interface Stats {
  activeDays: string[]; // YYYY-MM-DD
  minutesByDay: Record<string, number>;
  quizzesTaken: number;
  cardsReviewed: number;
  summariesMade: number;
}
