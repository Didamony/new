import type { ReactNode } from "react";
import { RefreshCw, Sparkles, Square } from "lucide-react";
import { Dots, ErrorBox, Skeleton } from "../../components/ui";
import { useT } from "../../lib/i18n";
import type { Job } from "../../lib/jobs";

export function GenerateBar({
  title,
  options,
  job,
  hasResult,
  onRun,
  onStop,
}: {
  title: string;
  options?: ReactNode;
  job: Job;
  hasResult: boolean;
  onRun: () => void;
  onStop: () => void;
}) {
  const { t } = useT();
  return (
    <div className="panel-head no-print">
      <div className="stack" style={{ gap: 10 }}>
        <h2 className="h2">{title}</h2>
        {options && <div className="opts">{options}</div>}
      </div>
      {job.running ? (
        <button className="btn" onClick={onStop}>
          <Square size={15} /> {t("stop")}
        </button>
      ) : (
        <button className={"btn " + (hasResult ? "" : "primary")} onClick={onRun}>
          {hasResult ? <RefreshCw size={16} /> : <Sparkles size={16} />}
          {hasResult ? t("regenerate") : t("generate")}
        </button>
      )}
    </div>
  );
}

export function Opt({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="opt-label">{label}</span>
      {children}
    </div>
  );
}

export function Placeholder({ icon, tone, text, onRun }: { icon: ReactNode; tone: string; text: string; onRun: () => void }) {
  const { t } = useT();
  return (
    <div className="placeholder">
      <div className={"art " + tone}>{icon}</div>
      <p>{text}</p>
      <button className="btn primary lg" onClick={onRun}>
        <Sparkles size={18} /> {t("generate")}
      </button>
    </div>
  );
}

export function Working({ job }: { job: Job }) {
  const { t } = useT();
  if (job.error) return <ErrorBox error={job.error} />;
  if (!job.running) return null;
  return (
    <div className="stack">
      <div className="row muted small">
        <Dots /> {t("generating")}
      </div>
      <Skeleton />
    </div>
  );
}

export const countOptions = (ns: number[], fmt: (n: number) => string) => ns.map((n) => ({ value: n, label: fmt(n) }));
