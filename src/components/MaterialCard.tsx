import { FileText, Image as ImageIcon, Type } from "lucide-react";
import { formatDate, useT } from "../lib/i18n";
import type { Material } from "../lib/types";
import { go } from "./ui";

const tints = ["tone-primary", "tone-accent", "tone-warm", "tone-pink"];

export function MaterialCard({ m, cards }: { m: Material; cards?: number }) {
  const { t, lang } = useT();
  const Icon = m.kind === "pdf" ? FileText : m.kind === "images" ? ImageIcon : Type;
  const tint = tints[m.id.charCodeAt(m.id.length - 1) % tints.length];
  const done = [m.summary, m.questions, m.quiz, m.mindmap].filter(Boolean).length;
  return (
    <button className="material" onClick={() => go(`/m/${m.id}`)}>
      <div className={"emoji " + tint}>{m.emoji}</div>
      <div className="grow">
        <b dir="auto">{m.title}</b>
        <div className="meta">
          <span className="chip">
            <Icon size={12} /> {t(m.kind === "pdf" ? "src_pdf" : m.kind === "images" ? "src_images" : "src_text")}
          </span>
          <span className="chip">{formatDate(m.updatedAt, lang)}</span>
          {!!cards && <span className="chip tone-pink">🃏 {cards}</span>}
          {done > 0 && <span className="chip tone-accent">✓ {done}/4</span>}
        </div>
      </div>
    </button>
  );
}

export const EMOJIS = ["📘", "📗", "📕", "📙", "🧪", "🧬", "🧮", "🌍", "🏛️", "💡", "🧠", "📐", "⚛️", "🎨", "💻", "📜"];
