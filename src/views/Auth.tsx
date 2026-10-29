import { useState } from "react";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { sendCode, useAccount, verifyCode } from "../lib/account";
import { num, useT } from "../lib/i18n";
import { updateSettings, useSettings } from "../lib/store";
import logo from "../assets/logo.svg";

export default function Auth() {
  const { t, lang } = useT();
  const { access } = useAccount();
  const settings = useSettings();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const Back = lang === "ar" ? ArrowRight : ArrowLeft;

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sendCode(email.trim());
      setStep("code");
    } catch {
      setError(t("send_error"));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await verifyCode(email.trim(), code.trim());
    } catch {
      setError(t("auth_error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <div className="gate-card card">
        <div className="row between">
          <img src={logo} alt="" width={56} height={56} style={{ borderRadius: 17 }} />
          <button className="btn ghost sm" onClick={() => updateSettings({ lang: settings.lang === "ar" ? "en" : "ar" })}>
            {settings.lang === "ar" ? "English" : "العربية"}
          </button>
        </div>
        <h1 className="h1" style={{ marginTop: 18 }}>
          {t("auth_title")}
        </h1>
        <p className="muted">{t("auth_sub", { n: num(access?.trial_days ?? 3, lang) })}</p>

        {step === "email" ? (
          <form className="stack" onSubmit={send}>
            <label className="label" htmlFor="email" style={{ margin: 0 }}>
              {t("email")}
            </label>
            <input id="email" className="input ltr" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <button className="btn primary lg block" disabled={busy || !email.includes("@")}>
              {busy ? <span className="spinner" /> : <Mail size={18} />} {t("send_code")}
            </button>
          </form>
        ) : (
          <form className="stack" onSubmit={verify}>
            <div className="alert info">{t("code_sent", { e: email })}</div>
            <label className="label" htmlFor="code" style={{ margin: 0 }}>
              {t("code")}
            </label>
            <input
              id="code"
              className="input ltr code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              autoFocus
            />
            <button className="btn primary lg block" disabled={busy || code.length < 6}>
              {busy && <span className="spinner" />} {t("verify")}
            </button>
            <div className="row between">
              <button type="button" className="btn ghost sm" onClick={() => (setStep("email"), setCode(""))}>
                <Back size={15} /> {t("change_email")}
              </button>
              <button type="button" className="btn ghost sm" disabled={busy} onClick={() => send()}>
                {t("resend")}
              </button>
            </div>
          </form>
        )}
        {error && (
          <div className="alert" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
