import { useState } from "react";
import { GalleryVerticalEnd, Layers, Trash2 } from "lucide-react";
import { go, Segmented, toast } from "../../components/ui";
import { prompts, runJson, schemas } from "../../lib/ai";
import { num, useT } from "../../lib/i18n";
import { runJob, stopJob, useJob } from "../../lib/jobs";
import { newCard } from "../../lib/srs";
import { deleteCard, listCards, saveCards, useLive } from "../../lib/store";
import type { Material } from "../../lib/types";
import { countOptions, GenerateBar, Opt, Placeholder, Working } from "./common";

export function Cards({ m }: { m: Material }) {
  const { t, lang } = useT();
  const key = `${m.id}:cards`;
  const job = useJob(key);
  const [count, setCount] = useState(15);
  const cards = useLive(async () => (await listCards()).filter((c) => c.materialId === m.id).sort((a, b) => a.createdAt - b.createdAt), ["cards"], [m.id]);

  function run() {
    runJob(key, async (signal) => {
      const r = await runJson<{ cards: { front: string; back: string }[] }>({ material: m, task: prompts.flashcards(count), schema: schemas.flashcards, signal });
      const fresh = r.cards.filter((c) => c.front.trim() && c.back.trim()).map((c) => newCard(m.id, c.front.trim(), c.back.trim()));
      await saveCards(fresh);
      toast(t("cards_added", { n: num(fresh.length, lang) }));
    });
  }

  async function removeAll() {
    if (!cards || !confirm(t("delete_cards") + "?")) return;
    await Promise.all(cards.map((c) => deleteCard(c.id)));
  }

  const has = !!cards?.length;

  return (
    <div className="card">
      <GenerateBar
        title={t("tool_cards")}
        job={job}
        hasResult={false}
        onRun={run}
        onStop={() => stopJob(key)}
        options={
          <Opt label={t("count")}>
            <Segmented value={count} onChange={setCount} options={countOptions([10, 15, 25, 40], (n) => num(n, lang))} />
          </Opt>
        }
      />
      <Working job={job} />
      {!job.running && !has && !job.error && (
        <Placeholder icon={<GalleryVerticalEnd size={32} />} tone="tone-pink" text={t("tool_cards_sub")} onRun={run} />
      )}
      {has && (
        <>
          <div className="row between wrap" style={{ margin: "8px 0 14px" }}>
            <b>{t("cards_in_deck", { n: num(cards!.length, lang) })}</b>
            <div className="row">
              <button className="btn primary sm" onClick={() => go(`/review/${m.id}`)}>
                <Layers size={15} /> {t("study_cards")}
              </button>
              <button className="btn danger sm" onClick={removeAll}>
                <Trash2 size={15} /> {t("delete_cards")}
              </button>
            </div>
          </div>
          <div className="terms">
            {cards!.map((c) => (
              <div key={c.id} className="term" style={{ borderInlineStartColor: "var(--pink)" }} dir="auto">
                <div className="row between" style={{ alignItems: "flex-start" }}>
                  <b style={{ color: "var(--pink)" }}>{c.front}</b>
                  <button className="btn ghost sm" aria-label={t("remove")} onClick={() => deleteCard(c.id)} style={{ padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="small">{c.back}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
