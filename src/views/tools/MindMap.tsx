import { Network } from "lucide-react";
import { prompts, runJson, schemas } from "../../lib/ai";
import { useT } from "../../lib/i18n";
import { runJob, stopJob, useJob } from "../../lib/jobs";
import { patchMaterial } from "../../lib/store";
import type { Material, MindNode } from "../../lib/types";
import { GenerateBar, Placeholder, Working } from "./common";

const COLORS = ["#7c6cff", "#14b8a6", "#f59e0b", "#ec4899", "#4f8cff", "#22c55e", "#ef4444"];

export function MindMap({ m }: { m: Material }) {
  const { t } = useT();
  const key = `${m.id}:mindmap`;
  const job = useJob(key);

  function run() {
    runJob(key, async (signal) => {
      const r = await runJson<MindNode>({ material: m, task: prompts.mindmap, schema: schemas.mindmap, signal });
      await patchMaterial(m.id, { mindmap: r });
    });
  }

  const map = m.mindmap;

  return (
    <div className="card">
      <GenerateBar title={t("tool_mindmap")} job={job} hasResult={!!map} onRun={run} onStop={() => stopJob(key)} />
      <Working job={job} />
      {!job.running && !map && !job.error && <Placeholder icon={<Network size={32} />} tone="tone-primary" text={t("tool_mindmap_sub")} onRun={run} />}
      {!job.running && map && (
        <div className="mind" dir="auto">
          <div style={{ textAlign: "center" }}>
            <div className="mind-root">{map.title}</div>
          </div>
          <div className="mind-branches">
            {map.children?.map((b, i) => (
              <div key={i} className="branch" style={{ ["--c" as string]: COLORS[i % COLORS.length] }}>
                <b>{b.title}</b>
                {!!b.children?.length && (
                  <ul>
                    {b.children.map((c, j) => (
                      <li key={j}>
                        {c.title}
                        {!!c.children?.length && (
                          <ul>
                            {c.children.map((d, k) => (
                              <li key={k}>{d.title}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
