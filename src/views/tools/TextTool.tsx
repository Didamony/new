import { useState } from "react";
import { Copy, Lightbulb, NotebookPen, Printer, Volume2, VolumeX } from "lucide-react";
import { ErrorBox, Markdown, Segmented, toast, useSpeech } from "../../components/ui";
import { AiError, prompts, streamText, type SummaryStyle } from "../../lib/ai";
import { useT } from "../../lib/i18n";
import { runJob, stopJob, useJob } from "../../lib/jobs";
import { bumpStats, patchMaterial } from "../../lib/store";
import type { Material } from "../../lib/types";
import { GenerateBar, Opt, Placeholder } from "./common";

export function TextTool({ m, kind }: { m: Material; kind: "summary" | "explain" }) {
  const { t } = useT();
  const key = `${m.id}:${kind}`;
  const job = useJob(key);
  const [style, setStyle] = useState<SummaryStyle>((m.summary?.style as SummaryStyle) ?? "detailed");
  const speech = useSpeech();
  const saved = kind === "summary" ? m.summary?.content : m.explain;
  const content = job.running ? job.partial : saved;

  function run() {
    runJob(key, async (signal, onPartial) => {
      let last = "";
      try {
        const text = await streamText({
          material: m,
          task: kind === "summary" ? prompts.summary(style) : prompts.explain,
          signal,
          onText: (s) => onPartial((last = s)),
        });
        last = text;
      } catch (e) {
        // keep what was already written if the student pressed stop
        if (!(e instanceof AiError && e.code === "aborted" && last)) throw e;
      }
      await patchMaterial(m.id, kind === "summary" ? { summary: { style, content: last } } : { explain: last });
      if (kind === "summary") bumpStats((s) => void s.summariesMade++);
    });
  }

  async function copy() {
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(saved);
      toast(t("copied"));
    } catch {
      /* clipboard blocked */
    }
  }

  const title = kind === "summary" ? t("tool_summary") : t("tool_explain");

  return (
    <div className="card">
      <GenerateBar
        title={title}
        job={job}
        hasResult={!!saved}
        onRun={run}
        onStop={() => stopJob(key)}
        options={
          kind === "summary" && (
            <Opt label={t("style")}>
              <Segmented
                value={style}
                onChange={setStyle}
                options={[
                  { value: "brief", label: t("style_brief") },
                  { value: "detailed", label: t("style_detailed") },
                  { value: "bullets", label: t("style_bullets") },
                  { value: "exam", label: t("style_exam") },
                ]}
              />
            </Opt>
          )
        }
      />

      <ErrorBox error={job.error} />

      {saved && !job.running && (
        <div className="result-actions no-print">
          <button className="btn sm" onClick={copy}>
            <Copy size={15} /> {t("copy")}
          </button>
          {speech.supported && (
            <button className="btn sm" onClick={() => (speech.speaking ? speech.stop() : speech.speak(saved))}>
              {speech.speaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
              {speech.speaking ? t("stop_listen") : t("listen")}
            </button>
          )}
          <button className="btn sm" onClick={() => window.print()}>
            <Printer size={15} /> {t("print")}
          </button>
        </div>
      )}

      {content ? (
        <Markdown text={content} streaming={job.running} />
      ) : job.running ? (
        <div className="placeholder">
          <span className="spinner" style={{ margin: "0 auto", width: 28, height: 28, color: "var(--primary)" }} />
          <p>{t("generating")}</p>
        </div>
      ) : (
        !job.error && (
          <Placeholder
            icon={kind === "summary" ? <NotebookPen size={32} /> : <Lightbulb size={32} />}
            tone={kind === "summary" ? "tone-primary" : "tone-warm"}
            text={kind === "summary" ? t("tool_summary_sub") : t("tool_explain_sub")}
            onRun={run}
          />
        )
      )}
    </div>
  );
}
