import { BookA } from "lucide-react";
import { prompts, runJson, schemas } from "../../lib/ai";
import { useT } from "../../lib/i18n";
import { runJob, stopJob, useJob } from "../../lib/jobs";
import { patchMaterial } from "../../lib/store";
import type { Material, Term } from "../../lib/types";
import { GenerateBar, Placeholder, Working } from "./common";

export function Terms({ m }: { m: Material }) {
  const { t } = useT();
  const key = `${m.id}:terms`;
  const job = useJob(key);

  function run() {
    runJob(key, async (signal) => {
      const r = await runJson<{ terms: Term[] }>({ material: m, task: prompts.terms, schema: schemas.terms, signal });
      await patchMaterial(m.id, { terms: r.terms });
    });
  }

  return (
    <div className="card">
      <GenerateBar title={t("tool_terms")} job={job} hasResult={!!m.terms} onRun={run} onStop={() => stopJob(key)} />
      <Working job={job} />
      {!job.running && !m.terms && !job.error && <Placeholder icon={<BookA size={32} />} tone="tone-accent" text={t("tool_terms_sub")} onRun={run} />}
      {!job.running && m.terms && (
        <div className="terms">
          {m.terms.map((x, i) => (
            <div key={i} className="term" dir="auto">
              <b>{x.term}</b>
              <div className="small">{x.definition}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
