import { useEffect, useState } from "react";
import { BadgeCheck, Banknote, CalendarPlus, Clock, Save, Search, Users, XCircle } from "lucide-react";
import { toast } from "../components/ui";
import { adminCancel, adminGrantPeriod, adminSaveSettings, adminStats, adminUsers, useAccount, type AdminStats, type UserRow } from "../lib/account";
import { formatDate, num, useT } from "../lib/i18n";

export default function Owner() {
  const { t, lang } = useT();
  const { access, status } = useAccount();
  const [price, setPrice] = useState(access?.price_egp ?? 20);
  const [trial, setTrial] = useState(access?.trial_days ?? 3);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const isAdmin = status.kind === "admin";

  async function load() {
    try {
      const [s, u] = await Promise.all([adminStats(), adminUsers(search)]);
      setStats(s);
      setUsers(u);
    } catch {
      toast(t("err_unknown"));
    }
  }

  useEffect(() => {
    if (access) {
      setPrice(access.price_egp);
      setTrial(access.trial_days);
    }
  }, [access?.price_egp, access?.trial_days]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isAdmin) return;
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [isAdmin, search]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="card empty">🔒 {t("not_admin")}</div>
      </div>
    );
  }

  async function save() {
    setBusy(true);
    try {
      await adminSaveSettings(price, trial);
      toast(t("saved"));
    } catch {
      toast(t("err_unknown"));
    } finally {
      setBusy(false);
    }
  }

  async function act(u: UserRow, kind: "grant" | "cancel") {
    if (!confirm(kind === "grant" ? t("confirm_grant") : t("confirm_revoke"))) return;
    try {
      await (kind === "grant" ? adminGrantPeriod(u.user_id) : adminCancel(u.user_id));
      await load();
    } catch {
      toast(t("err_unknown"));
    }
  }

  const now = Date.now();

  return (
    <div className="page">
      <h1 className="h1">{t("owner_title")}</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        {t("owner_sub")}
      </p>

      <div className="stats">
        <Stat icon={Users} tone="tone-primary" value={num(stats?.users ?? 0, lang)} label={t("st_users")} />
        <Stat icon={Clock} tone="tone-warm" value={num(stats?.in_trial ?? 0, lang)} label={t("st_trial")} />
        <Stat icon={BadgeCheck} tone="tone-accent" value={num(stats?.active ?? 0, lang)} label={t("st_paid")} />
        <Stat icon={Banknote} tone="tone-pink" value={num(stats?.revenue_month_egp ?? 0, lang)} label={t("st_month_revenue")} />
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="row wrap" style={{ gap: 16, alignItems: "flex-end" }}>
          <div>
            <label className="label" htmlFor="price">
              {t("price_egp")}
            </label>
            <input id="price" className="input" type="number" min={0} style={{ maxWidth: 180 }} value={price} onChange={(e) => setPrice(Math.max(0, Math.round(+e.target.value)))} />
          </div>
          <div>
            <label className="label" htmlFor="trial">
              {t("trial_days")}
            </label>
            <input id="trial" className="input" type="number" min={0} max={60} style={{ maxWidth: 140 }} value={trial} onChange={(e) => setTrial(Math.max(0, Math.round(+e.target.value)))} />
          </div>
          <button className="btn primary" disabled={busy} onClick={save}>
            {busy ? <span className="spinner" /> : <Save size={16} />} {t("save")}
          </button>
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>
          {t("trial_days_note")}
        </div>
        <div className="small muted" style={{ marginTop: 4 }}>
          {t("st_revenue")}: <b>{num(stats?.revenue_egp ?? 0, lang)}</b>
        </div>
      </section>

      <div className="section-title">
        <h2 className="h2">{t("users")}</h2>
      </div>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={18} className="muted" style={{ position: "absolute", insetInlineStart: 14, top: 14 }} />
        <input className="input" style={{ paddingInlineStart: 42 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search_email")} />
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {users.map((u) => {
          const until = u.paid_until ? new Date(u.paid_until).getTime() : 0;
          const active = until > now;
          const inTrial = !active && new Date(u.trial_ends_at).getTime() > now;
          return (
            <div key={u.user_id} className="card row wrap" style={{ padding: 12 }}>
              <div className="grow" style={{ minWidth: 180 }}>
                <b className="ltr" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {u.email}
                </b>
                <span className="small muted">
                  {t("joined")} {formatDate(new Date(u.created_at).getTime(), lang)}
                </span>
              </div>
              <span className={"chip " + (u.is_admin ? "tone-primary" : active ? "tone-accent" : inTrial ? "tone-warm" : "tone-danger")}>
                {u.is_admin
                  ? t("plan_admin")
                  : active
                    ? `${t("plan_active")} · ${t("until", { d: formatDate(until, lang) })}`
                    : inTrial
                      ? t("plan_trial")
                      : t("st_expired")}
              </span>
              {!u.is_admin && (
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => act(u, "grant")}>
                    <CalendarPlus size={15} /> {t("grant")}
                  </button>
                  {active && (
                    <button className="btn sm danger" aria-label={t("revoke")} title={t("revoke")} onClick={() => act(u, "cancel")}>
                      <XCircle size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, tone, value, label }: { icon: typeof Users; tone: string; value: string; label: string }) {
  return (
    <div className="card stat">
      <div className={"ic " + tone}>
        <Icon size={21} />
      </div>
      <div>
        <b>{value}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}
