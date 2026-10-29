import { useEffect, useState } from "react";
import { Crown, Download, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { go, Segmented } from "../components/ui";
import { billingEnabled, signOut, useAccount } from "../lib/account";
import AiSettings from "./AiSettings";
import { formatDate, num, useT } from "../lib/i18n";
import { updateSettings, useSettings } from "../lib/store";
import type { Lang, Theme } from "../lib/types";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

let deferredInstall: InstallPrompt | null = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e as InstallPrompt;
});


export default function Settings() {
  const { t, lang } = useT();
  const s = useSettings();
  const account = useAccount();
  const [canInstall, setCanInstall] = useState(!!deferredInstall);
  const standalone = matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    const on = () => setCanInstall(true);
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);


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
              <span className={"chip " + (account.status.kind === "trial" ? "tone-warm" : account.status.kind === "expired" ? "tone-danger" : "tone-accent")}>
                {account.status.kind === "admin"
                  ? t("plan_admin")
                  : account.status.kind === "active"
                    ? `${t("plan_active")} · ${t("until", { d: formatDate(account.status.until, lang) })}`
                    : account.status.kind === "trial"
                      ? `${t("plan_trial")} · ${num(account.status.daysLeft, lang)}`
                      : t("st_expired")}
              </span>
            </div>
            <div className="row wrap">
              {(account.status.kind === "trial" || account.status.kind === "active") && (
                <button className="btn primary sm" onClick={() => go("/upgrade")}>
                  <Crown size={15} /> {account.status.kind === "active" ? t("renew") : t("upgrade_price", { p: num(account.access?.price_egp ?? 20, lang) })}
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

      <AiSettings />

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
