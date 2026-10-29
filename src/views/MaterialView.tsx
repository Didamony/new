import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookA,
  ClipboardCheck,
  FileSearch,
  GalleryVerticalEnd,
  HelpCircle,
  LayoutGrid,
  Lightbulb,
  MessageCircle,
  Network,
  NotebookPen,
  Pencil,
  Trash2,
} from "lucide-react";
import { go, Modal } from "../components/ui";
import { EMOJIS } from "../components/MaterialCard";
import { formatDate, useT, type TKey } from "../lib/i18n";
import { deleteMaterial, getMaterial, patchMaterial, useLive } from "../lib/store";
import { Cards } from "./tools/Cards";
import { Chat } from "./tools/Chat";
import { MindMap } from "./tools/MindMap";
import { Questions } from "./tools/Questions";
import { Quiz } from "./tools/Quiz";
import { Source } from "./tools/Source";
import { Terms } from "./tools/Terms";
import { TextTool } from "./tools/TextTool";

export const TOOLS = [
  { key: "summary", icon: NotebookPen, tone: "tone-primary", title: "tool_summary", sub: "tool_summary_sub" },
  { key: "questions", icon: HelpCircle, tone: "tone-pink", title: "tool_questions", sub: "tool_questions_sub" },
  { key: "quiz", icon: ClipboardCheck, tone: "tone-accent", title: "tool_quiz", sub: "tool_quiz_sub" },
  { key: "cards", icon: GalleryVerticalEnd, tone: "tone-warm", title: "tool_cards", sub: "tool_cards_sub" },
  { key: "explain", icon: Lightbulb, tone: "tone-warm", title: "tool_explain", sub: "tool_explain_sub" },
  { key: "terms", icon: BookA, tone: "tone-accent", title: "tool_terms", sub: "tool_terms_sub" },
  { key: "mindmap", icon: Network, tone: "tone-primary", title: "tool_mindmap", sub: "tool_mindmap_sub" },
  { key: "chat", icon: MessageCircle, tone: "tone-pink", title: "tool_chat", sub: "tool_chat_sub" },
] as const satisfies readonly { key: string; title: TKey; sub: TKey; tone: string; icon: unknown }[];

export default function MaterialView({ id, tool }: { id: string; tool?: string }) {
  const { t, lang } = useT();
  const m = useLive(async () => (await getMaterial(id)) ?? null, ["materials"], [id]);
  const [editing, setEditing] = useState(false);
  const Back = lang === "ar" ? ArrowRight : ArrowLeft;

  if (m === undefined) return null;
  if (!m) {
    go("/library");
    return null;
  }

  const active = tool ?? "home";
  const open = (k: string) => go(`/m/${m.id}/${k}`);

  async function remove() {
    if (!confirm(t("confirm_delete"))) return;
    await deleteMaterial(m!.id);
    go("/library");
  }

  let panel;
  switch (active) {
    case "summary":
      panel = <TextTool m={m} kind="summary" />;
      break;
    case "explain":
      panel = <TextTool m={m} kind="explain" />;
      break;
    case "questions":
      panel = <Questions m={m} />;
      break;
    case "quiz":
      panel = <Quiz m={m} />;
      break;
    case "cards":
      panel = <Cards m={m} />;
      break;
    case "terms":
      panel = <Terms m={m} />;
      break;
    case "mindmap":
      panel = <MindMap m={m} />;
      break;
    case "chat":
      panel = <Chat m={m} />;
      break;
    case "source":
      panel = <Source m={m} />;
      break;
    default:
      panel = (
        <div className="tool-grid">
          {TOOLS.map((x) => (
            <button key={x.key} className="source" onClick={() => open(x.key)}>
              <div className={"ic " + x.tone}>
                <x.icon size={22} />
              </div>
              <b>{t(x.title)}</b>
              <span>{t(x.sub)}</span>
            </button>
          ))}
        </div>
      );
  }

  return (
    <div className="page">
      <div className="mat-head no-print">
        <button className="icon-btn" aria-label={t("back")} onClick={() => (active === "home" ? go("/library") : open(""))}>
          <Back size={19} />
        </button>
        <div className="emoji">{m.emoji}</div>
        <div className="grow">
          <h1 className="h2" dir="auto" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {m.title}
          </h1>
          <div className="small muted">{t("created", { d: formatDate(m.createdAt, lang) })}</div>
        </div>
        <button className="icon-btn" aria-label={t("rename")} onClick={() => setEditing(true)}>
          <Pencil size={17} />
        </button>
        <button className="icon-btn" aria-label={t("delete_material")} onClick={remove} style={{ color: "var(--danger)" }}>
          <Trash2 size={17} />
        </button>
      </div>

      <div className="tools no-print">
        <button className={"tool" + (active === "home" ? " on" : "")} onClick={() => open("")}>
          <LayoutGrid size={16} /> {t("tools")}
        </button>
        {TOOLS.map((x) => (
          <button key={x.key} className={"tool" + (active === x.key ? " on" : "")} onClick={() => open(x.key)}>
            <x.icon size={16} /> {t(x.title)}
          </button>
        ))}
        <button className={"tool" + (active === "source" ? " on" : "")} onClick={() => open("source")}>
          <FileSearch size={16} /> {t("tool_source")}
        </button>
      </div>

      {panel}

      {editing && <RenameModal title={m.title} emoji={m.emoji} onClose={() => setEditing(false)} onSave={(title, emoji) => patchMaterial(m.id, { title, emoji })} />}
    </div>
  );
}

function RenameModal({ title, emoji, onClose, onSave }: { title: string; emoji: string; onClose: () => void; onSave: (t: string, e: string) => void }) {
  const { t } = useT();
  const [v, setV] = useState(title);
  const [e, setE] = useState(emoji);
  return (
    <Modal onClose={onClose}>
      <div className="stack">
        <h2 className="h2">{t("rename")}</h2>
        <input className="input" dir="auto" value={v} onChange={(ev) => setV(ev.target.value)} autoFocus />
        <div className="row wrap" style={{ gap: 6 }}>
          {EMOJIS.map((x) => (
            <button
              key={x}
              className="icon-btn"
              style={{ fontSize: 20, borderColor: x === e ? "var(--primary)" : undefined, background: x === e ? "var(--primary-soft)" : undefined }}
              onClick={() => setE(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            className="btn primary"
            disabled={!v.trim()}
            onClick={() => {
              onSave(v.trim(), e);
              onClose();
            }}
          >
            {t("save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
