import { ArrowLeft, ArrowRight, Camera, Crown, Clock, FileText, Flame, Image as ImageIcon, Layers, Library, Quote, Settings, Sparkles, Timer, Type } from "lucide-react";
import { MaterialCard } from "../components/MaterialCard";
import { go } from "../components/ui";
import { num, useT, type TKey } from "../lib/i18n";
import { useAccount } from "../lib/account";
import { dayKey, getStats, listCards, listMaterials, streakOf, useLive, useSettings } from "../lib/store";

export const SOURCES = [
  { key: "pdf", icon: FileText, tone: "tone-primary", title: "src_pdf", sub: "src_pdf_sub" },
  { key: "camera", icon: Camera, tone: "tone-pink", title: "src_camera", sub: "src_camera_sub" },
  { key: "images", icon: ImageIcon, tone: "tone-warm", title: "src_images", sub: "src_images_sub" },
  { key: "text", icon: Type, tone: "tone-accent", title: "src_text", sub: "src_text_sub" },
] as const;

export default function Home({ due }: { due: number }) {
  const { t, lang } = useT();
  const settings = useSettings();
  const materials = useLive(listMaterials, ["materials"]);
  const stats = useLive(getStats, ["stats"]);
  const cards = useLive(listCards, ["cards"]) ?? [];
  const { status, access } = useAccount();

  const hour = new Date().getHours();
  const greet = t(hour < 15 && hour >= 4 ? "greet_morning" : "greet_evening");
  const streak = stats ? streakOf(stats.activeDays) : 0;
  const todayMin = stats?.minutesByDay[dayKey()] ?? 0;
  const goal = settings.dailyGoalMinutes || 1;
  const pct = Math.min(100, Math.round((todayMin / goal) * 100));
  const quoteKey = `quote_${(new Date().getDate() % 5) + 1}` as TKey;
  const Arrow = lang === "ar" ? ArrowLeft : ArrowRight;
  const cardCount = (id: string) => cards.filter((c) => c.materialId === id).length;

  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="row">
          <img src="./icon.svg" alt="" width={36} height={36} style={{ borderRadius: 11 }} />
          <b style={{ fontSize: 18 }}>{t("appName")}</b>
        </div>
        <button className="icon-btn" aria-label={t("nav_settings")} onClick={() => go("/settings")}>
          <Settings size={19} />
        </button>
      </div>

      <section className="hero">
        <div className="row between wrap" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 className="h1">
              {greet}
              {settings.name ? (lang === "ar" ? "، " : ", ") + settings.name : ""} 👋
            </h1>
            <div style={{ opacity: 0.9, marginTop: 4 }}>{t("greet_sub")}</div>
          </div>
          <div className="chip" style={{ background: "rgba(255,255,255,.2)", color: "#fff", fontSize: 14, padding: "6px 12px" }}>
            <Flame size={16} /> {num(streak, lang)} {t("streak")}
          </div>
        </div>
        <div className="row between small" style={{ marginTop: 20, opacity: 0.95 }}>
          <span>
            {t("daily_goal")}: {num(todayMin, lang)} / {num(goal, lang)}
          </span>
          <span>{pct >= 100 ? t("goal_done") : t("goal_left", { n: num(goal - todayMin, lang) })}</span>
        </div>
        <div className="goal-bar">
          <div style={{ width: `${Math.max(pct, 3)}%` }} />
        </div>
        <div className="quote">
          <Quote size={16} style={{ flexShrink: 0, marginTop: 3 }} />
          <span>{t(quoteKey)}</span>
        </div>
      </section>

      {(status.kind === "trial" || (status.kind === "active" && status.daysLeft <= 5)) && (
        <button className="trial-banner" onClick={() => go("/upgrade")}>
          <Crown size={20} />
          <span className="grow">
            <b>
              {status.kind === "active"
                ? t("sub_left", { n: num(status.daysLeft, lang) })
                : status.daysLeft > 1
                  ? t("trial_left", { n: num(status.daysLeft, lang) })
                  : t("trial_left_hours", { n: num(status.hoursLeft, lang) })}
            </b>
            <span className="small">{status.kind === "active" ? t("renew") : t("upgrade_price", { p: num(access?.price_egp ?? 20, lang) })}</span>
          </span>
          <Arrow size={18} />
        </button>
      )}

      <div className="stats">
        <Stat icon={Flame} tone="tone-warm" value={num(streak, lang)} label={t("streak")} />
        <Stat icon={Clock} tone="tone-primary" value={num(todayMin, lang)} label={t("today_minutes")} />
        <Stat icon={Layers} tone="tone-pink" value={num(due, lang)} label={t("due_cards")} />
        <Stat icon={Library} tone="tone-accent" value={num(materials?.length ?? 0, lang)} label={t("materials_count")} />
      </div>

      <div className="section-title">
        <h2 className="h2">
          <Sparkles size={18} style={{ verticalAlign: -3, color: "var(--primary)" }} /> {t("quick_start")}
        </h2>
      </div>
      <div className="sources">
        {SOURCES.map((s) => (
          <button key={s.key} className="source" onClick={() => go(`/add/${s.key}`)}>
            <div className={"ic " + s.tone}>
              <s.icon size={22} />
            </div>
            <b>{t(s.title)}</b>
            <span>{t(s.sub)}</span>
          </button>
        ))}
      </div>

      {(due > 0 || (materials && materials.length > 0)) && (
        <div className="row wrap" style={{ marginTop: 14, gap: 10 }}>
          {due > 0 && (
            <button className="card row grow" style={{ cursor: "pointer", minWidth: 240, textAlign: "start" }} onClick={() => go("/review")}>
              <div className="ic tone-pink" style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center" }}>
                <Layers size={22} />
              </div>
              <div className="grow">
                <b>{t("review_now")}</b>
                <div className="small muted">
                  {num(due, lang)} {t("due_cards")}
                </div>
              </div>
              <Arrow size={18} className="muted" />
            </button>
          )}
          <button className="card row grow" style={{ cursor: "pointer", minWidth: 240, textAlign: "start" }} onClick={() => go("/focus")}>
            <div className="ic tone-accent" style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center" }}>
              <Timer size={22} />
            </div>
            <div className="grow">
              <b>{t("start_focus")}</b>
              <div className="small muted">
                {num(settings.focusMinutes, lang)} + {num(settings.breakMinutes, lang)}
              </div>
            </div>
            <Arrow size={18} className="muted" />
          </button>
        </div>
      )}

      <div className="section-title">
        <h2 className="h2">{t("recent")}</h2>
        {materials && materials.length > 4 && (
          <button className="btn ghost sm" onClick={() => go("/library")}>
            {t("see_all")} <Arrow size={15} />
          </button>
        )}
      </div>
      {materials && materials.length === 0 && (
        <div className="card empty">
          <div className="art">📚</div>
          <h3 className="h2">{t("empty_library")}</h3>
          <p className="muted">{t("empty_library_sub")}</p>
          <button className="btn primary lg" onClick={() => go("/add")}>
            <Sparkles size={18} /> {t("add_first")}
          </button>
        </div>
      )}
      <div className="materials">
        {materials?.slice(0, 6).map((m) => <MaterialCard key={m.id} m={m} cards={cardCount(m.id)} />)}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, tone, value, label }: { icon: typeof Flame; tone: string; value: string; label: string }) {
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
