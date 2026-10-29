import { useEffect, useMemo, useState, type ReactNode } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import { AiError } from "../lib/ai";
import { KeySetup } from "./KeySetup";
import { useT, type TKey } from "../lib/i18n";

/* ---------------- routing ---------------- */

export function useRoute() {
  const [hash, setHash] = useState(() => location.hash.slice(1) || "/");
  useEffect(() => {
    const on = () => {
      setHash(location.hash.slice(1) || "/");
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  // payment redirects may append "?query" after the hash route
  return hash.split("?")[0].split("/").filter(Boolean);
}

export function go(path: string) {
  location.hash = path;
}

/* ---------------- toast ---------------- */

let showToast: (msg: string) => void = () => {};

export function toast(msg: string) {
  showToast(msg);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: number;
    showToast = (m) => {
      setMsg(m);
      clearTimeout(timer);
      timer = window.setTimeout(() => setMsg(null), 2600);
    };
  }, []);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}

/* ---------------- markdown ---------------- */

marked.setOptions({ gfm: true, breaks: false });

export function Markdown({ text, streaming }: { text: string; streaming?: boolean }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text, { async: false })), [text]);
  return <div className={"md" + (streaming ? " cursor" : "")} dir="auto" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ---------------- small pieces ---------------- */

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Dots() {
  return (
    <span className="loading-dots" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

export function Skeleton({ lines = 6 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <i key={i} style={{ width: `${55 + ((i * 37) % 45)}%` }} />
      ))}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const { t } = useT();
  if (!error) return null;
  const code = error instanceof AiError ? error.code : "unknown";
  if (code === "aborted") return null;
  // no key yet: show the setup steps instead of an error
  if (code === "no-key") return <KeySetup />;
  const key = ("err_" + code.replace("-", "_")) as TKey;
  const needsSettings = code === "auth" || code === "permission" || code === "quota";
  const detail = error instanceof AiError && code === "unknown" && error.message !== "unknown" ? error.message : null;
  return (
    <div className="alert" role="alert">
      <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
      <div className="grow">
        <div>{t(key)}</div>
        {detail && <div className="small" style={{ opacity: 0.8, marginTop: 4 }} dir="auto">{detail}</div>}
        {needsSettings && (
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => go("/settings")}>
            <SettingsIcon size={15} /> {t("go_settings")}
          </button>
        )}
      </div>
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/** Read-aloud via the browser's built-in speech synthesis (free, offline on most devices). */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => speechSynthesis?.cancel(), []);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  function speak(markdownText: string) {
    if (!supported) return;
    speechSynthesis.cancel();
    const plain = markdownText.replace(/[#*_`>|-]+/g, " ").replace(/\s+/g, " ");
    const u = new SpeechSynthesisUtterance(plain);
    u.lang = /[؀-ۿ]/.test(plain) ? "ar-EG" : "en-US";
    u.rate = 1;
    u.onend = u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    speechSynthesis.speak(u);
  }
  function stop() {
    speechSynthesis.cancel();
    setSpeaking(false);
  }
  return { speaking, speak, stop, supported };
}
