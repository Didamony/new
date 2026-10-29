import { useEffect, useState } from "react";
import { Check, Crown, Download, LogOut, UserRound, ExternalLink, Eye, EyeOff, KeyRound, Monitor, Moon, Sun } from "lucide-react";
import { ErrorBox, go, Segmented } from "../components/ui";
import { billingEnabled, signOut, useAccount } from "../lib/account";
import { MODELS, testKey } from "../lib/ai";
import { num, useT } from "../lib/i18n";
import { updateSettings, useSettings } from "../lib/store";
import type { Lang, OutputLang, Theme } from "../lib/types";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

let deferredInstall: InstallPrompt | null = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e as InstallPrompt;
});

const MODEL_NAMES = { "claude-opus-5-5": "Claude Opus 5.5", "claude-sonnet-5-5": "Claude Sonnet 5.5", "claude-haiku-5-5": "Claude Haiku 5.5" };

export default function Settings() {
  const { t, lang } = useT();
  const s = useSettings();
  const account = useAccount();
  const [key, setKey] = useState(s.apiKey);
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<{ state: "idle" | "busy" | "ok"; error?: unknown }>({ state: "idle" });
  const [canInstall, setCanInstall] = useState(!!deferredInstall);
  const standalone = matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    const on = () => setCanInstall(true);
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  function saveKey(v: string) {
    setKey(v);
    updateSettings({ apiKey: v.trim() });
    setTest({ state: "idle" });
  }

  async function runTest() {
    setTest({ state: "busy" });
    try {
      await testKey();
      setTest({ state: "ok" });
    } catch (error) {
      setTest({ state: "idle", error });
    }
  }

  const tierLabel = { best: t("model_best"), balanced: t("model_balanced"), cheap: t("model_cheap") };

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1 className="h1" style={{ marginBottom: 18 }}>
        {t("settings_title")}
      </h1>

      {billingEnabled && account.session && (
        <section className="card" style={{ marginBottom: 14 }}>
          <h2 className="h2 row">
            <UserRound size={19} style={{ color: "var(--primary)" }} /> {t("account")}
          </h2>
          <div className="setting">
            <div className="row between wrap">
              <span className="ltr">{account.session.user.email}</span>
              <span className={"chip " + (account.status.kind === "trial" ? "tone-warm" : "tone-accent")}>
                {account.status.kind === "admin"
                  ? t("plan_admin")
                  : account.status.kind === "lifetime"
                    ? t("plan_lifetime")
                    : account.status.kind === "trial"
                      ? `${t("plan_trial")} · ${num(account.status.daysLeft, lang)}`
                      : t("st_expired")}
              </span>
            </div>
            <div className="row wrap">
              {account.status.kind === "trial" && (
                <button className="btn primary sm" onClick={() => go("/upgrade")}>
                  <Crown size={15} /> {t("upgrade_price", { p: num(account.access?.price_egp ?? 100, lang) })}
                </button>
              )}
              {account.status.kind === "admin" && (
                <button className="btn sm" onClick={() => go("/owner")}>
                  <Crown size={15} /> {t("owner_page")}
                </button>
              )}
              <button className="btn ghost sm" onClick={() => signOut()}>
                <LogOut size={15} /> {t("sign_out")}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="card" style={{ marginBottom: 14 }}>
        <h2 className="h2 row">
          <KeyRound size={19} style={{ color: "var(--primary)" }} /> {t("ai_section")}
        </h2>

        <div className="setting">
          <label className="label" htmlFor="key" style={{ margin: 0 }}>
            {t("api_key")}
          </label>
          <div className="row">
            <input
              id="key"
              className="input ltr"
              type={show ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              value={key}
              onChange={(e) => saveKey(e.target.value)}
            />
            <button className="icon-btn" aria-label={show ? t("hide") : t("show")} onClick={() => setShow(!show)}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="small muted">{t("api_key_help")}</div>
          <div className="row wrap">
            <button className="btn sm" disabled={!key.trim() || test.state === "busy"} onClick={runTest}>
              {test.state === "busy" ? <span className="spinner" /> : test.state === "ok" ? <Check size={15} /> : null}
              {test.state === "ok" ? t("key_ok") : t("test_key")}
            </button>
            <a className="btn sm ghost" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              <ExternalLink size={15} /> console.anthropic.com
            </a>
          </div>
          <ErrorBox error={test.error} />
          <details>
            <summary className="small" style={{ cursor: "pointer", color: "var(--primary)", fontWeight: 600 }}>
              {t("get_key")}
            </summary>
            <div className="small muted" style={{ whiteSpace: "pre-line", marginTop: 8 }}>
              {t("key_steps")}
            </div>
          </details>
        </div>

        <div className="setting">
          <span className="label" style={{ margin: 0 }}>
            {t("model")}
          </span>
          <div className="stack" style={{ gap: 8 }}>
            {MODELS.map((m) => (
              <button key={m.id} className={"model-opt" + (s.model === m.id ? " on" : "")} onClick={() => updateSettings({ model: m.id })}>
                <span className="radio" />
                <span className="grow">
                  <b style={{ display: "block" }}>{MODEL_NAMES[m.id]}</b>
                  <span className="small muted">{tierLabel[m.tier]}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

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

      <section className="card" style={{ marginBottom: 14 }}>
        <h2 className="h2">{t("appearance")}</h2>
        <div className="setting">
          <span className="label" style={{ margin: 0 }}>
            {t("language")}
          </span>
          <Segmented<Lang>
            value={s.lang}
            onChange={(v) => updateSettings({ lang: v })}
            options={[
              { value: "ar", label: "العربية" },
              { value: "en", label: "English" },
            ]}
          />
        </div>
        <div className="setting">
          <span className="label" style={{ margin: 0 }}>
            {t("theme")}
          </span>
          <Segmented<Theme>
            value={s.theme}
            onChange={(v) => updateSettings({ theme: v })}
            options={[
              { value: "light", label: <span className="row" style={{ gap: 6 }}><Sun size={15} /> {t("theme_light")}</span> },
              { value: "dark", label: <span className="row" style={{ gap: 6 }}><Moon size={15} /> {t("theme_dark")}</span> },
              { value: "system", label: <span className="row" style={{ gap: 6 }}><Monitor size={15} /> {t("theme_system")}</span> },
            ]}
          />
        </div>
      </section>

      <section className="card" style={{ marginBottom: 14 }}>
        <h2 className="h2">{t("study_section")}</h2>
        <div className="setting">
          <label className="label" htmlFor="name" style={{ margin: 0 }}>
            {t("your_name")}
          </label>
          <input id="name" className="input" dir="auto" value={s.name} onChange={(e) => updateSettings({ name: e.target.value })} />
        </div>
        <NumberSetting label={t("daily_goal_min")} value={s.dailyGoalMinutes} min={5} max={600} onChange={(v) => updateSettings({ dailyGoalMinutes: v })} />
        <NumberSetting label={t("focus_len")} value={s.focusMinutes} min={5} max={120} onChange={(v) => updateSettings({ focusMinutes: v })} />
        <NumberSetting label={t("break_len")} value={s.breakMinutes} min={1} max={60} onChange={(v) => updateSettings({ breakMinutes: v })} />
      </section>

      {!standalone && (
        <section className="card" style={{ marginBottom: 14 }}>
          <h2 className="h2 row">
            <Download size={19} style={{ color: "var(--accent)" }} /> {t("install_app")}
          </h2>
          <p className="small muted">{t("install_hint")}</p>
          {canInstall && (
            <button
              className="btn primary"
              onClick={async () => {
                await deferredInstall?.prompt();
                deferredInstall = null;
                setCanInstall(false);
              }}
            >
              <Download size={16} /> {t("install")}
            </button>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="h2">{t("data_section")}</h2>
        <p className="small muted">{t("data_note")}</p>
      </section>
    </div>
  );
}

function NumberSetting({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="setting">
      <label className="label" style={{ margin: 0 }}>
        {label}
      </label>
      <input
        className="input"
        type="number"
        min={min}
        max={max}
        style={{ maxWidth: 140 }}
        defaultValue={value}
        onChange={(e) => {
          const v = Math.round(+e.target.value);
          if (v >= min && v <= max) onChange(v);
        }}
      />
    </div>
  );
}
