import { useEffect } from "react";
import { PartyPopper, RefreshCw } from "lucide-react";
import { go } from "../components/ui";
import { refreshAccess, useAccount, useRefreshOnMount } from "../lib/account";
import { useT } from "../lib/i18n";

/** Paymob sends the student back here after checkout. */
export default function Paid() {
  const { t } = useT();
  const { status } = useAccount();
  useRefreshOnMount();
  const ok = status.kind === "lifetime" || status.kind === "admin";

  // the webhook usually lands a few seconds after the redirect
  useEffect(() => {
    if (ok) return;
    let n = 0;
    const id = setInterval(() => (++n > 10 ? clearInterval(id) : refreshAccess()), 3000);
    return () => clearInterval(id);
  }, [ok]);

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <div className="card empty">
        {ok ? (
          <>
            <PartyPopper size={56} style={{ color: "var(--primary)" }} />
            <h1 className="h2" style={{ marginTop: 14 }}>
              {t("paid_ok")}
            </h1>
            <button className="btn primary lg" style={{ marginTop: 16 }} onClick={() => go("/")}>
              {t("continue")}
            </button>
          </>
        ) : (
          <>
            <span className="spinner" style={{ width: 40, height: 40, margin: "0 auto", color: "var(--primary)" }} />
            <h1 className="h2" style={{ marginTop: 14 }}>
              {t("paid_title")}
            </h1>
            <p className="muted">{t("paid_wait")}</p>
            <button className="btn" onClick={() => refreshAccess()}>
              <RefreshCw size={16} /> {t("refresh")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
