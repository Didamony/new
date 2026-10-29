import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CreditCard, LogOut, RefreshCw } from "lucide-react";
import { go } from "../components/ui";
import { refreshAccess, signOut, startCheckout, useAccount } from "../lib/account";
import { num, useT } from "../lib/i18n";

/** Shown full-screen when the trial ended, or as a normal page when upgrading early. */
export default function Paywall({ blocking }: { blocking: boolean }) {
  const { t, lang } = useT();
  const { access, session } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const price = access?.price_egp ?? 100;
  const Back = lang === "ar" ? ArrowRight : ArrowLeft;

  async function pay() {
    setBusy(true);
    setError("");
    try {
      await startCheckout();
    } catch {
      setError(t("pay_error"));
      setBusy(false);
    }
  }

  const body = (
    <div className="gate-card card paywall">
      {!blocking && (
        <button className="icon-btn" aria-label={t("back")} onClick={() => history.back()} style={{ marginBottom: 8 }}>
          <Back size={18} />
        </button>
      )}
      <div className="paywall-badge">✨</div>
      <h1 className="h1" style={{ textAlign: "center" }}>
        {blocking ? t("paywall_title") : t("paywall_title_upgrade")}
      </h1>
      <p className="muted" style={{ textAlign: "center" }}>
        {t("paywall_sub")}
      </p>

      <div className="price">
        <b>{num(price, lang)}</b>
        <span>{t("egp")}</span>
      </div>
      <div className="chip tone-accent" style={{ margin: "0 auto 18px", display: "flex", width: "fit-content" }}>
        {t("once")}
      </div>

      <ul className="perks">
        {(["perk_1", "perk_2", "perk_3", "perk_4"] as const).map((k) => (
          <li key={k}>
            <span>
              <Check size={14} strokeWidth={3} />
            </span>
            {t(k)}
          </li>
        ))}
      </ul>

      <button className="btn primary lg block" disabled={busy} onClick={pay}>
        {busy ? <span className="spinner" /> : <CreditCard size={18} />} {t("pay_now", { p: num(price, lang) })}
      </button>
      <div className="small muted" style={{ textAlign: "center", marginTop: 8 }}>
        {t("pay_methods")}
      </div>
      {error && (
        <div className="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      <div className="row between wrap" style={{ marginTop: 18 }}>
        <button className="btn ghost sm" onClick={() => refreshAccess()}>
          <RefreshCw size={15} /> {t("already_paid")}
        </button>
        {blocking && (
          <button className="btn ghost sm" onClick={() => signOut().then(() => go("/"))}>
            <LogOut size={15} /> {t("sign_out")}
          </button>
        )}
      </div>
      {session?.user.email && (
        <div className="small muted ltr" style={{ textAlign: "center", marginTop: 6 }}>
          {session.user.email}
        </div>
      )}
    </div>
  );

  return blocking ? <div className="gate">{body}</div> : <div className="page" style={{ maxWidth: 520 }}>{body}</div>;
}
