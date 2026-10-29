import { useMemo, useState } from "react";
import { PartyPopper } from "lucide-react";
import { go, Segmented } from "../components/ui";
import { num, useT } from "../lib/i18n";
import { isDue, previewInterval, schedule, type Grade } from "../lib/srs";
import { bumpStats, listCards, listMaterials, saveCards, useLive } from "../lib/store";

function fmtInterval(ms: number, lang: "ar" | "en") {
  const min = Math.round(ms / 60000);
  if (min < 60) return lang === "ar" ? `${num(min, lang)} د` : `${min}m`;
  const d = Math.round(ms / 86400000);
  return lang === "ar" ? `${num(d, lang)} يوم` : `${d}d`;
}

export default function Review({ materialId }: { materialId?: string }) {
  const { t, lang } = useT();
  const cards = useLive(listCards, ["cards"]);
  const materials = useLive(listMaterials, ["materials"]) ?? [];
  const [filter, setFilter] = useState(materialId ?? "all");
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const pool = useMemo(() => (cards ?? []).filter((c) => filter === "all" || c.materialId === filter), [cards, filter]);
  const due = useMemo(() => pool.filter(isDue).sort((a, b) => a.due - b.due), [pool]);
  const card = due[0];
  const withCards = materials.filter((m) => cards?.some((c) => c.materialId === m.id));

  async function grade(g: Grade) {
    if (!card) return;
    setFlipped(false);
    // let the flip-back animation start before the card changes
    await new Promise((r) => setTimeout(r, 160));
    await saveCards([schedule(card, g)]);
    setReviewed((n) => n + 1);
    bumpStats((s) => void s.cardsReviewed++);
  }

  const grades: { g: Grade; label: string; cls: string }[] = [
    { g: 0, label: t("again"), cls: "tone-danger" },
    { g: 1, label: t("hard"), cls: "tone-warm" },
    { g: 2, label: t("good"), cls: "tone-primary" },
    { g: 3, label: t("easy"), cls: "tone-accent" },
  ];

  return (
    <div className="page">
      <h1 className="h1">{t("review_title")}</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        {t("review_sub")}
      </p>

      <div className="row wrap" style={{ margin: "16px 0", gap: 8 }}>
        <span className="chip tone-pink">
          {t("due_now")}: {num(due.length, lang)}
        </span>
        <span className="chip">
          {t("total_cards")}: {num(pool.length, lang)}
        </span>
        {reviewed > 0 && <span className="chip tone-accent">✓ {num(reviewed, lang)}</span>}
      </div>

      {withCards.length > 1 && (
        <div style={{ marginBottom: 18, overflowX: "auto" }}>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[{ value: "all", label: t("all_materials") }, ...withCards.map((m) => ({ value: m.id, label: `${m.emoji} ${m.title.slice(0, 18)}` }))]}
          />
        </div>
      )}

      {cards && !card && (
        <div className="card empty">
          <PartyPopper size={48} style={{ color: "var(--primary)" }} />
          <h2 className="h2" style={{ marginTop: 12 }}>
            {reviewed > 0 ? t("review_done") : t("review_empty")}
          </h2>
          <p className="muted">{t("review_empty_sub")}</p>
          <button className="btn primary" onClick={() => go("/library")}>
            {t("nav_library")}
          </button>
        </div>
      )}

      {card && (
        <>
          <div className="flash-wrap">
            <div className={"flash" + (flipped ? " flipped" : "")} onClick={() => setFlipped(!flipped)} role="button" aria-pressed={flipped}>
              <div className="flash-face front" dir="auto">
                {card.front}
                <span className="hint">{t("tap_flip")}</span>
              </div>
              <div className="flash-face back" dir="auto">
                {card.back}
              </div>
            </div>
          </div>
          <div className="grades" style={{ visibility: flipped ? "visible" : "hidden" }}>
            {grades.map((x) => (
              <button key={x.g} className={"grade " + x.cls} onClick={() => grade(x.g)}>
                {x.label}
                <small>{fmtInterval(previewInterval(card, x.g), lang)}</small>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
