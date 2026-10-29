import { useEffect, useState } from "react";
import { Check, ExternalLink, Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react";
import { ErrorBox, Segmented } from "../components/ui";
import { activeProvider, MODELS, testClaudeKey } from "../lib/ai";
import { billingEnabled, useAccount } from "../lib/account";
import { DEFAULT_GEMINI_MODEL, listModels, type GeminiModel } from "../lib/gemini";
import { num, useT } from "../lib/i18n";
import { updateSettings, useSettings } from "../lib/store";
import type { OutputLang, Provider } from "../lib/types";

const CLAUDE_NAMES = { "claude-opus-5-5": "Claude Opus 5.5", "claude-sonnet-5-5": "Claude Sonnet 5.5", "claude-haiku-5-5": "Claude Haiku 5.5" };

type Test = { state: "idle" | "busy" | "ok"; error?: unknown };

export default function AiSettings() {
  const { t, lang } = useT();
  const s = useSettings();
  const { access } = useAccount();
  const provider = activeProvider();
  const isFree = provider === "free";
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<Test>({ state: "idle" });
  const [geminiModels, setGeminiModels] = useState<GeminiModel[] | null>(null);
  const isGemini = provider === "gemini";
  const key = isGemini ? s.geminiKey : s.apiKey;

  useEffect(() => setTest({ state: "idle" }), [s.provider]);

  // load the models this Gemini key can use, so the picker never offers a retired model
  useEffect(() => {
    if (!isGemini || !s.geminiKey) return setGeminiModels(null);
    let alive = true;
    const id = setTimeout(() => {
      listModels(s.geminiKey)
        .then((list) => alive && setGeminiModels(list))
        .catch(() => alive && setGeminiModels(null));
    }, 500);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [isGemini, s.geminiKey]);

  function setKey(v: string) {
    updateSettings(isGemini ? { geminiKey: v.trim() } : { apiKey: v.trim() });
    setTest({ state: "idle" });
  }

  async function runTest() {
    setTest({ state: "busy" });
    try {
      if (isGemini) {
        const list = await listModels();
        setGeminiModels(list);
        // first connection: pick the best available model automatically
        if (list.length && !list.some((m) => m.id === s.geminiModel)) updateSettings({ geminiModel: list[0].id });
      } else {
        await testClaudeKey();
      }
      setTest({ state: "ok" });
    } catch (error) {
      setTest({ state: "idle", error });
    }
  }

  const tierLabel = { best: t("model_best"), balanced: t("model_balanced"), cheap: t("model_cheap") };
  const currentGemini = s.geminiModel || DEFAULT_GEMINI_MODEL;

  return (
    <section className="card" style={{ marginBottom: 14 }}>
      <h2 className="h2 row">
        <KeyRound size={19} style={{ color: "var(--primary)" }} /> {t("ai_section")}
      </h2>

      <div className="setting">
        <span className="label" style={{ margin: 0 }}>
          {t("provider")}
        </span>
        <Segmented<Provider>
          value={provider}
          onChange={(v) => updateSettings({ provider: v })}
          options={[
            ...(billingEnabled ? [{ value: "free" as const, label: t("prov_free") }] : []),
            { value: "claude", label: t("prov_claude_own") },
            { value: "gemini", label: t("prov_gemini_own") },
          ]}
        />
        {!isFree && <div className="small muted">{isGemini ? t("gemini_note") : t("claude_note")}</div>}
      </div>

      {isFree && (
        <div className="setting">
          <div className="alert ok">
            <div className="stack" style={{ gap: 6 }}>
              <span>{t("free_note", { limit: num(access?.free_daily_limit ?? 0, lang) })}</span>
              {access && (
                <b>
                  {t("free_left", {
                    n: num(Math.max(0, access.free_daily_limit - access.free_used_today), lang),
                    limit: num(access.free_daily_limit, lang),
                  })}
                </b>
              )}
            </div>
          </div>
          <div className="small muted">{t("free_tip")}</div>
        </div>
      )}

      {!isFree && (
        <>

      <div className="setting">
        <label className="label" htmlFor="key" style={{ margin: 0 }}>
          {isGemini ? t("gemini_key") : t("api_key")}
        </label>
        <div className="row">
          <input
            id="key"
            key={s.provider}
            className="input ltr"
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder={isGemini ? "AIza…" : "sk-ant-…"}
            defaultValue={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button className="icon-btn" aria-label={show ? t("hide") : t("show")} onClick={() => setShow(!show)}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <div className="small muted">{isGemini ? t("gemini_key_help") : t("api_key_help")}</div>
        <div className="row wrap">
          <button className="btn sm" disabled={!key || test.state === "busy"} onClick={runTest}>
            {test.state === "busy" ? <span className="spinner" /> : test.state === "ok" ? <Check size={15} /> : null}
            {test.state === "ok" ? t("key_ok") : t("test_key")}
          </button>
          <a
            className="btn sm ghost"
            href={isGemini ? "https://aistudio.google.com/apikey" : "https://console.anthropic.com/settings/keys"}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} /> {isGemini ? "aistudio.google.com" : "console.anthropic.com"}
          </a>
        </div>
        <ErrorBox error={test.error} />
        <details>
          <summary className="small" style={{ cursor: "pointer", color: "var(--primary)", fontWeight: 600 }}>
            {t("get_key")}
          </summary>
          <div className="small muted" style={{ whiteSpace: "pre-line", marginTop: 8 }}>
            {isGemini ? t("gemini_key_steps") : t("key_steps")}
          </div>
        </details>
      </div>

      <div className="setting">
        <span className="label" style={{ margin: 0 }}>
          {t("model")}
        </span>
        {isGemini ? (
          <>
            <div className="row">
              <select className="select ltr" value={currentGemini} onChange={(e) => updateSettings({ geminiModel: e.target.value })}>
                {!geminiModels?.some((m) => m.id === currentGemini) && <option value={currentGemini}>{currentGemini}</option>}
                {geminiModels?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
              <button className="icon-btn" aria-label={t("refresh")} disabled={!s.geminiKey} onClick={runTest}>
                <RefreshCw size={17} />
              </button>
            </div>
            <div className="small muted">{t("gemini_model_hint")}</div>
          </>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {MODELS.map((m) => (
              <button key={m.id} className={"model-opt" + (s.model === m.id ? " on" : "")} onClick={() => updateSettings({ model: m.id })}>
                <span className="radio" />
                <span className="grow">
                  <b style={{ display: "block" }}>{CLAUDE_NAMES[m.id]}</b>
                  <span className="small muted">{tierLabel[m.tier]}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

        </>
      )}

      <div className="setting">
        <span className="label" style={{ margin: 0 }}>
          {t("output_lang")}
        </span>
        <Segmented<OutputLang>
          value={s.outputLang}
          onChange={(v) => updateSettings({ outputLang: v })}
          options={[
            { value: "auto", label: t("out_auto") },
            { value: "ar", label: "العربية" },
            { value: "en", label: "English" },
          ]}
        />
      </div>
    </section>
  );
}
