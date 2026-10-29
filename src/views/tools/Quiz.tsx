import { useState } from "react";
import { Check, ClipboardCheck, RotateCcw, Sparkles, X } from "lucide-react";
import { Segmented } from "../../components/ui";
import { prompts, runJson, schemas, type Difficulty } from "../../lib/ai";
import { num, useT } from "../../lib/i18n";
import { runJob, stopJob, useJob } from "../../lib/jobs";
import { bumpStats, patchMaterial } from "../../lib/store";
import type { Material, QuizItem } from "../../lib/types";
import { countOptions, GenerateBar, Opt, Placeholder, Working } from "./common";
import { DifficultyPicker } from "./Questions";

const LETTERS_AR = ["أ", "ب", "ج", "د", "هـ", "و"];
const LETTERS_EN = ["A", "B", "C", "D", "E", "F"];

export function Quiz({ m }: { m: Material }) {
  const { t, lang } = useT();
  const key = `${m.id}:quiz`;
  const job = useJob(key);
  const [count, setCount] = useState(10);
  const [diff, setDiff] = useState<Difficulty>("mixed");
  const [answers, setAnswers] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const quiz = m.quiz?.filter((q) => q.options.length >= 2 && q.correct_index >= 0 && q.correct_index < q.options.length);
  const letters = lang === "ar" ? LETTERS_AR : LETTERS_EN;

  function reset() {
    setAnswers([]);
    setIdx(0);
    setDone(false);
  }

  function run() {
    reset();
    runJob(key, async (signal) => {
      const r = await runJson<{ quiz: QuizItem[] }>({ material: m, task: prompts.quiz(count, diff), schema: schemas.quiz, signal });
      await patchMaterial(m.id, { quiz: r.quiz });
    });
  }

  const bar = (
    <GenerateBar
      title={t("tool_quiz")}
      job={job}
      hasResult={!!quiz}
      onRun={run}
      onStop={() => stopJob(key)}
      options={
        <>
          <Opt label={t("count")}>
            <Segmented value={count} onChange={setCount} options={countOptions([5, 10, 15, 20], (n) => num(n, lang))} />
          </Opt>
          <Opt label={t("difficulty")}>
            <DifficultyPicker value={diff} onChange={setDiff} />
          </Opt>
        </>
      }
    />
  );

  if (job.running || job.error || !quiz?.length) {
    return (
      <div className="card">
        {bar}
        <Working job={job} />
        {!job.running && !job.error && (
          <Placeholder icon={<ClipboardCheck size={32} />} tone="tone-accent" text={t("tool_quiz_sub")} onRun={run} />
        )}
      </div>
    );
  }

  const score = answers.filter((a, i) => quiz[i] && a === quiz[i].correct_index).length;
  const pct = Math.round((score / quiz.length) * 100);

  if (done) {
    const r = 64;
    const c = 2 * Math.PI * r;
    const color = pct >= 80 ? "var(--success)" : pct >= 50 ? "var(--warm)" : "var(--danger)";
    return (
      <div className="card">
        {bar}
        <div style={{ textAlign: "center" }}>
          <div className="muted">{t("quiz_score")}</div>
          <div className="score-ring">
            <svg viewBox="0 0 150 150" width="150" height="150">
              <circle cx="75" cy="75" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
              <circle
                cx="75"
                cy="75"
                r={r}
                fill="none"
                stroke={color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - pct / 100)}
                style={{ transition: "stroke-dashoffset 1s ease" }}
              />
            </svg>
            <b style={{ color }}>{num(pct, lang)}%</b>
          </div>
          <div className="h2">
            {num(score, lang)} / {num(quiz.length, lang)}
          </div>
          <p>{pct >= 80 ? t("quiz_great") : pct >= 50 ? t("quiz_good") : t("quiz_low")}</p>
          {m.quizBest != null && <div className="small muted">{t("quiz_best", { n: num(m.quizBest, lang) })}</div>}
          <div className="row wrap" style={{ justifyContent: "center", marginTop: 16 }}>
            <button className="btn" onClick={reset}>
              <RotateCcw size={16} /> {t("quiz_retry")}
            </button>
            <button className="btn primary" onClick={run}>
              <Sparkles size={16} /> {t("quiz_new")}
            </button>
          </div>
        </div>

        <h3 className="h2" style={{ margin: "28px 0 12px" }}>
          {t("quiz_review")}
        </h3>
        <div className="stack" style={{ gap: 10 }}>
          {quiz.map((q, i) => {
            const ok = answers[i] === q.correct_index;
            return (
              <div key={i} className="qa" style={{ padding: 14 }}>
                <div className="row" style={{ alignItems: "flex-start" }}>
                  <span className={"qa-num " + (ok ? "tone-accent" : "tone-danger")}>{ok ? <Check size={16} /> : <X size={16} />}</span>
                  <div className="grow" dir="auto">
                    <div style={{ fontWeight: 600 }}>{q.question}</div>
                    {!ok && answers[i] != null && (
                      <div className="small" style={{ color: "var(--danger)", marginTop: 4 }}>
                        ✗ {q.options[answers[i]]}
                      </div>
                    )}
                    <div className="small" style={{ color: "var(--success)", marginTop: 4 }}>
                      ✓ {q.options[q.correct_index]}
                    </div>
                    <div className="small muted" style={{ marginTop: 6 }}>
                      {q.explanation}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const q = quiz[idx];
  const chosen = answers[idx];
  const answered = chosen != null;

  function choose(i: number) {
    if (answered) return;
    const a = [...answers];
    a[idx] = i;
    setAnswers(a);
  }

  async function next() {
    if (idx < quiz!.length - 1) return setIdx(idx + 1);
    setDone(true);
    await patchMaterial(m.id, { quizBest: Math.max(m.quizBest ?? 0, pct) });
    bumpStats((s) => void s.quizzesTaken++);
  }

  return (
    <div className="card">
      {bar}
      <div className="row between small muted">
        <span>{t("quiz_q", { i: num(idx + 1, lang), n: num(quiz.length, lang) })}</span>
        <span>
          ✓ {num(score, lang)}
        </span>
      </div>
      <div className="quiz-progress">
        <div style={{ width: `${((idx + (answered ? 1 : 0)) / quiz.length) * 100}%` }} />
      </div>
      <div key={idx} style={{ animation: "rise .3s ease both" }}>
        <p className="quiz-q" dir="auto">
          {q.question}
        </p>
        <div className="options">
          {q.options.map((o, i) => {
            const cls = answered ? (i === q.correct_index ? " correct" : i === chosen ? " wrong" : "") : "";
            return (
              <button key={i} className={"option" + cls} disabled={answered} onClick={() => choose(i)} dir="auto">
                <span className="letter">{answered && i === q.correct_index ? <Check size={16} /> : answered && i === chosen ? <X size={16} /> : letters[i]}</span>
                <span className="grow">{o}</span>
              </button>
            );
          })}
        </div>
        {answered && (
          <div className="explain-box" dir="auto">
            <b style={{ color: chosen === q.correct_index ? "var(--success)" : "var(--danger)" }}>
              {chosen === q.correct_index ? `✓ ${t("correct")}` : `✗ ${t("wrong")}`}
            </b>{" "}
            — {q.explanation}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn primary" disabled={!answered} onClick={next}>
            {idx < quiz.length - 1 ? t("quiz_next") : t("quiz_finish")}
          </button>
        </div>
      </div>
    </div>
  );
}
