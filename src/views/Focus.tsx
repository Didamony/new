import { useEffect, useState } from "react";
import { Coffee, Pause, Play, RotateCcw, SkipForward, Target } from "lucide-react";
import { toast } from "../components/ui";
import { num, translate, useT } from "../lib/i18n";
import { bumpStats, dayKey, getSettings, getStats, useLive, useSettings } from "../lib/store";

type Phase = "work" | "break";

// Module-level so the timer survives navigating to another page.
const timer = { phase: "work" as Phase, endsAt: 0, remaining: 0, running: false, sessions: 0, lastTick: 0 };

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((d) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.2);
    });
  } catch {
    /* audio unavailable */
  }
}

const listeners = new Set<() => void>();

// Ticks globally so the session keeps counting while the student is on other pages.
setInterval(() => {
  if (!timer.running) return;
  const now = Date.now();
  if (timer.phase === "work") {
    const credited = Math.floor((Math.min(now, timer.endsAt) - timer.lastTick) / 60000);
    if (credited >= 1) {
      timer.lastTick += credited * 60000;
      bumpStats((st) => {
        const k = dayKey();
        st.minutesByDay[k] = (st.minutesByDay[k] ?? 0) + credited;
      });
    }
  }
  timer.remaining = Math.max(0, Math.round((timer.endsAt - now) / 1000));
  if (timer.remaining === 0) {
    const lang = getSettings().lang;
    timer.running = false;
    beep();
    if (timer.phase === "work") {
      timer.sessions++;
      timer.phase = "break";
      toast(translate(lang, "focus_done"));
    } else {
      timer.phase = "work";
      toast(translate(lang, "break_done"));
    }
  }
  listeners.forEach((f) => f());
}, 500);

export default function Focus() {
  const { t, lang } = useT();
  const s = useSettings();
  const stats = useLive(getStats, ["stats"]);
  const total = (timer.phase === "work" ? s.focusMinutes : s.breakMinutes) * 60;
  if (!timer.running && timer.remaining === 0) timer.remaining = total;
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  useEffect(() => {
    listeners.add(rerender);
    return () => void listeners.delete(rerender);
  }, []);

  function start() {
    timer.running = true;
    timer.endsAt = Date.now() + timer.remaining * 1000;
    timer.lastTick = Date.now();
    rerender();
  }
  function pause() {
    timer.running = false;
    rerender();
  }
  function reset() {
    timer.running = false;
    timer.remaining = total;
    rerender();
  }
  function skip() {
    timer.running = false;
    timer.phase = timer.phase === "work" ? "break" : "work";
    timer.remaining = 0;
    rerender();
  }

  const left = timer.remaining || total;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const r = 130;
  const c = 2 * Math.PI * r;
  const frac = left / total;
  const isWork = timer.phase === "work";
  const color = isWork ? "var(--primary)" : "var(--accent)";
  const todayMin = stats?.minutesByDay[dayKey()] ?? 0;

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <h1 className="h1">{t("focus_title")}</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        {t("focus_sub")}
      </p>

      <div className="card" style={{ marginTop: 18, textAlign: "center" }}>
        <span className={"chip " + (isWork ? "tone-primary" : "tone-accent")} style={{ fontSize: 14, padding: "6px 14px" }}>
          {isWork ? <Target size={15} /> : <Coffee size={15} />} {isWork ? t("focus_work") : t("focus_break")}
        </span>
        <div className="timer">
          <svg viewBox="0 0 300 300">
            <defs>
              <linearGradient id="tg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={isWork ? "#7c6cff" : "#22c3a6"} />
                <stop offset="1" stopColor={isWork ? "#4f8cff" : "#14b8a6"} />
              </linearGradient>
            </defs>
            <circle cx="150" cy="150" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
            <circle
              cx="150"
              cy="150"
              r={r}
              fill="none"
              stroke="url(#tg)"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - frac)}
              style={{ transition: "stroke-dashoffset .5s linear" }}
            />
          </svg>
          <div className="time">
            <b style={{ color }}>
              {mm}:{ss}
            </b>
            <span className="muted small">
              {t("sessions_today")}: {num(timer.sessions, lang)}
            </span>
          </div>
        </div>
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="icon-btn" aria-label={t("reset")} onClick={reset}>
            <RotateCcw size={18} />
          </button>
          {timer.running ? (
            <button className="btn primary lg" style={{ minWidth: 150 }} onClick={pause}>
              <Pause size={18} /> {t("pause")}
            </button>
          ) : (
            <button className="btn primary lg" style={{ minWidth: 150 }} onClick={start}>
              <Play size={18} /> {left < total ? t("resume") : t("start")}
            </button>
          )}
          <button className="icon-btn" aria-label={t("skip")} onClick={skip}>
            <SkipForward size={18} />
          </button>
        </div>
      </div>

      <div className="card row" style={{ marginTop: 14 }}>
        <div className="grow">
          <b>{t("daily_goal")}</b>
          <div className="small muted">
            {num(todayMin, lang)} / {num(s.dailyGoalMinutes, lang)} {t("today_minutes")}
          </div>
        </div>
        <div className="progress" style={{ width: 120 }}>
          <div style={{ width: `${Math.min(100, (todayMin / Math.max(1, s.dailyGoalMinutes)) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
