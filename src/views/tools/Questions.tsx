import { useState } from "react";
import { ChevronDown, Copy, HelpCircle, Printer } from "lucide-react";
import { Markdown, Segmented, toast } from "../../components/ui";
import { prompts, runJson, schemas, type Difficulty } from "../../lib/ai";
import { num, useT } from "../../lib/i18n";
import { runJob, stopJob, useJob } from "../../lib/jobs";
import { patchMaterial } from "../../lib/store";
import type { Material, QAItem } from "../../lib/types";
import { countOptions, GenerateBar, Opt, Placeholder, Working } from "./common";

export function DifficultyPicker({ value, onChange }: { value: Difficulty; onChange: (d: Difficulty) => void }) {
  const { t } = useT();
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={[
        { value: "easy", label: t("diff_easy") },
        { value: "medium", label: t("diff_medium") },
        { value: "hard", label: t("diff_hard") },
        { value: "mixed", label: t("diff_mixed") },
      ]}
    />
  );
}

export function Questions({ m }: { m: Material }) {
  const { t, lang } = useT();
  const key = `${m.id}:questions`;
  const job = useJob(key);
  const [count, setCount] = useState(10);
  const [diff, setDiff] = useState<Difficulty>("mixed");
  const [open, setOpen] = useState<Set<number>>(new Set());
  const items = m.questions;

  function run() {
    setOpen(new Set());
    runJob(key, async (signal) => {
      const r = await runJson<{ questions: QAItem[] }>({ material: m, task: prompts.questions(count, diff), schema: schemas.questions, signal });
      await patchMaterial(m.id, { questions: r.questions });
    });
  }

  const allOpen = !!items && open.size === items.length;
  const diffLabel = { easy: t("diff_easy"), medium: t("diff_medium"), hard: t("diff_hard") };

  async function copyAll() {
    if (!items) return;
    const s = items.map((q, i) => `${i + 1}. ${q.question}\n${q.answer}`).join("\n\n");
    try {
      await navigator.clipboard.writeText(s);
      toast(t("copied"));
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="card">
      <GenerateBar
        title={t("tool_questions")}
        job={job}
        hasResult={!!items}
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
      <Working job={job} />
      {!job.running && !items && !job.error && (
        <Placeholder icon={<HelpCircle size={32} />} tone="tone-pink" text={t("tool_questions_sub")} onRun={run} />
      )}
      {!job.running && items && (
        <>
          <div className="result-actions no-print">
            <button className="btn sm" onClick={() => setOpen(allOpen ? new Set() : new Set(items.map((_, i) => i)))}>
              {allOpen ? t("hide_all") : t("show_all")}
            </button>
            <button className="btn sm" onClick={copyAll}>
              <Copy size={15} /> {t("copy")}
            </button>
            <button className="btn sm" onClick={() => (setOpen(new Set(items.map((_, i) => i))), setTimeout(() => window.print(), 50))}>
              <Printer size={15} /> {t("print")}
            </button>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {items.map((q, i) => {
              const isOpen = open.has(i);
              return (
                <div key={i} className="qa">
                  <button
                    className="qa-q"
                    aria-expanded={isOpen}
                    onClick={() => {
                      const n = new Set(open);
                      if (isOpen) n.delete(i);
                      else n.add(i);
                      setOpen(n);
                    }}
                  >
                    <span className="qa-num">{num(i + 1, lang)}</span>
                    <div className="grow">
                      <div style={{ fontWeight: 600 }} dir="auto">
                        {q.question}
                      </div>
                      <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                        <span className="chip">{q.type}</span>
                        <span className={"chip " + q.difficulty}>{diffLabel[q.difficulty]}</span>
                      </div>
                    </div>
                    <ChevronDown size={18} className="muted" style={{ transform: isOpen ? "rotate(180deg)" : "", transition: ".2s", flexShrink: 0 }} />
                  </button>
                  {isOpen && (
                    <div className="qa-a">
                      <Markdown text={q.answer} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
