import { useEffect, useState } from "react";
import { BadgeCheck, Banknote, CalendarPlus, Clock, Save, Search, Sparkles, UserCheck, Users, XCircle } from "lucide-react";
import { toast } from "../components/ui";
import { adminCancel, adminGetSettings, adminGrantPeriod, adminSaveSettings, adminStats, adminUsers, useAccount, type AdminStats, type AppSettingsPatch, type UserRow } from "../lib/account";
import { formatDate, num, useT } from "../lib/i18n";

export default function Owner() {
  const { t, lang } = useT();
  const { status } = useAccount();
  const [form, setForm] = useState<AppSettingsPatch>({ price_egp: 20, trial_days: 3, free_daily_limit: 25, free_model: "" });
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
    if (status.kind === "admin") adminGetSettings().then(setForm, () => toast(t("err_unknown")));
  }, [status.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const setNum = (k: "price_egp" | "trial_days" | "free_daily_limit") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: Math.max(0, Math.round(+e.target.value)) });

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
      await adminSaveSettings({ ...form, free_model: form.free_model.trim() });
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
        <Stat icon={Sparkles} tone="tone-primary" value={num(stats?.ai_requests_today ?? 0, lang)} label={t("st_ai_today")} />
        <Stat icon={UserCheck} tone="tone-accent" value={num(stats?.ai_users_today ?? 0, lang)} label={t("st_ai_users")} />
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="row wrap" style={{ gap: 16, alignItems: "flex-end" }}>
          <div>
            <label className="label" htmlFor="price">
              {t("price_egp")}
            </label>
            <input id="price" className="input" type="number" min={0} style={{ maxWidth: 180 }} value={form.price_egp} onChange={setNum("price_egp")} />
          </div>
          <div>
            <label className="label" htmlFor="trial">
              {t("trial_days")}
            </label>
            <input id="trial" className="input" type="number" min={0} max={60} style={{ maxWidth: 140 }} value={form.trial_days} onChange={setNum("trial_days")} />
          </div>
          <div>
            <label className="label" htmlFor="limit">
              {t("free_limit_label")}
            </label>
            <input id="limit" className="input" type="number" min={0} max={1000} style={{ maxWidth: 140 }} value={form.free_daily_limit} onChange={setNum("free_daily_limit")} />
          </div>
          <div>
            <label className="label" htmlFor="fmodel">
              {t("free_model_label")}
            </label>
            <input id="fmodel" className="input ltr" style={{ maxWidth: 220 }} placeholder="auto" value={form.free_model} onChange={(e) => setForm({ ...form, free_model: e.target.value })} />
          </div>
          <button className="btn primary" disabled={busy} onClick={save}>
            {busy ? <span className="spinner" /> : <Save size={16} />} {t("save")}
          </button>
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>
          {t("trial_days_note")} {t("free_model_hint")}
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
