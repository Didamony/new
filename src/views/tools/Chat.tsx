import { useEffect, useRef, useState } from "react";
import { Send, Square, Trash2 } from "lucide-react";
import { ErrorBox, Markdown } from "../../components/ui";
import { AiError, streamText } from "../../lib/ai";
import { useT } from "../../lib/i18n";
import { runJob, stopJob, useJob } from "../../lib/jobs";
import { patchMaterial } from "../../lib/store";
import type { ChatMsg, Material } from "../../lib/types";

export function Chat({ m }: { m: Material }) {
  const { t } = useT();
  const key = `${m.id}:chat`;
  const job = useJob(key);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const history = m.chat ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history.length, job.partial, pending]);

  function send(text: string) {
    const q = text.trim();
    if (!q || job.running) return;
    setInput("");
    setPending(q);
    const convo: ChatMsg[] = [...history, { role: "user", content: q }];
    runJob(key, async (signal, onPartial) => {
      let last = "";
      try {
        last = await streamText({ material: m, task: "", history: convo, signal, onText: (s) => onPartial((last = s)) });
      } catch (e) {
        if (!(e instanceof AiError && e.code === "aborted" && last)) {
          setPending(null);
          setInput(q);
          throw e;
        }
      }
      await patchMaterial(m.id, { chat: [...convo, { role: "assistant", content: last }] });
      setPending(null);
    });
  }

  const suggestions = [t("chat_suggest_1"), t("chat_suggest_2"), t("chat_suggest_3")];

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 14 }}>
        <h2 className="h2">{t("tool_chat")}</h2>
        {history.length > 0 && !job.running && (
          <button className="btn ghost sm" onClick={() => patchMaterial(m.id, { chat: [] })}>
            <Trash2 size={15} /> {t("clear_chat")}
          </button>
        )}
      </div>
      <div className="chat">
        {history.length === 0 && !pending && !job.running && (
          <div className="placeholder">
            <div className="art tone-primary" style={{ fontSize: 30 }}>
              💬
            </div>
            <p>{t("chat_empty")}</p>
            <div className="suggest">
              {suggestions.map((s) => (
                <button key={s} className="btn sm" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="bubble user" dir="auto">
              {msg.content}
            </div>
          ) : (
            <div key={i} className="bubble assistant">
              <Markdown text={msg.content} />
            </div>
          ),
        )}
        {pending && (
          <div className="bubble user" dir="auto">
            {pending}
          </div>
        )}
        {job.running && (
          <div className="bubble assistant">{job.partial ? <Markdown text={job.partial} streaming /> : <span className="spinner" style={{ color: "var(--primary)" }} />}</div>
        )}
        <ErrorBox error={job.error} />
        <div ref={endRef} />
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          dir="auto"
          rows={1}
          value={input}
          placeholder={t("chat_ph")}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        {job.running ? (
          <button type="button" className="btn" onClick={() => stopJob(key)} aria-label={t("stop")}>
            <Square size={16} />
          </button>
        ) : (
          <button type="submit" className="btn primary" disabled={!input.trim()} aria-label={t("send")}>
            <Send size={16} style={{ transform: "scaleX(var(--flip, 1))" }} />
          </button>
        )}
      </form>
    </div>
  );
}
