import { useState } from "react";
import { Check, ExternalLink, KeyRound, Sparkles } from "lucide-react";
import { activeProvider } from "../lib/ai";
import { billingEnabled } from "../lib/account";
import { listModels } from "../lib/gemini";
import { useT } from "../lib/i18n";
import { updateSettings, useSettings } from "../lib/store";
import { ErrorBox, go } from "./ui";

/** True when the AI can't work yet because the student hasn't added a key. */
export function useNeedsKey() {
  const s = useSettings();
  if (billingEnabled && s.provider === "free") return false;
  const p = activeProvider();
  return p === "claude" ? !s.apiKey : p === "gemini" ? !s.geminiKey : false;
}

/** Two-step card that gets a student from zero to a working free Gemini key. */
export function KeySetup() {
  const { t } = useT();
  const [key, setKey] = useState("");
  const [state, setState] = useState<{ busy?: boolean; error?: unknown; ok?: boolean }>({});

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      const models = await listModels(key.trim());
      updateSettings({
        provider: "gemini",
        geminiKey: key.trim(),
        geminiModel: models.find((m) => /^gemini-[\d.]+-flash$/.test(m.id))?.id ?? models[0]?.id ?? "",
      });
      setState({ ok: true });
    } catch (error) {
      setState({ error });
    }
  }

  if (state.ok) {
    return (
      <div className="card setup-card">
        <div className="alert ok">
          <Check size={20} /> {t("setup_ok")}
        </div>
      </div>
    );
  }

  return (
    <section className="card setup-card">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="setup-icon">
          <Sparkles size={22} />
        </div>
        <div className="grow">
          <h2 className="h2">{t("setup_title")}</h2>
          <p className="muted small" style={{ margin: "4px 0 0" }}>
            {t("setup_sub")}
          </p>
        </div>
      </div>

      <ol className="setup-steps">
        <li>
          <b>{t("setup_step1")}</b>
          <span className="small muted">{t("setup_step1_hint")}</span>
          <a className="btn sm" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> {t("setup_step1_btn")}
          </a>
        </li>
        <li>
          <b>{t("setup_step2")}</b>
          <form className="row" onSubmit={save}>
            <input
              id="setup-key"
              className="input ltr"
              autoComplete="off"
              spellCheck={false}
              placeholder="AIza…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <button className="btn primary" disabled={key.trim().length < 20 || state.busy}>
              {state.busy ? <span className="spinner" /> : <KeyRound size={16} />} {t("setup_save")}
            </button>
          </form>
        </li>
      </ol>
      <ErrorBox error={state.error} />
      <div className="small muted">
        {t("setup_private")}{" "}
        <button className="link-btn" onClick={() => go("/settings")}>
          {t("setup_other")}
        </button>
      </div>
    </section>
  );
}
