import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { MaterialCard } from "../components/MaterialCard";
import { go } from "../components/ui";
import { useT } from "../lib/i18n";
import { listCards, listMaterials, useLive } from "../lib/store";

export default function Library() {
  const { t } = useT();
  const materials = useLive(listMaterials, ["materials"]);
  const cards = useLive(listCards, ["cards"]) ?? [];
  const [q, setQ] = useState("");
  const shown = materials?.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 16 }}>
        <h1 className="h1">{t("nav_library")}</h1>
        <button className="btn primary" onClick={() => go("/add")}>
          <Plus size={18} /> {t("nav_add")}
        </button>
      </div>
      {materials && materials.length > 0 && (
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={18} className="muted" style={{ position: "absolute", insetInlineStart: 14, top: 14 }} />
          <input className="input" style={{ paddingInlineStart: 42 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="…" />
        </div>
      )}
      {materials && materials.length === 0 && (
        <div className="card empty">
          <div className="art">📚</div>
          <h3 className="h2">{t("empty_library")}</h3>
          <p className="muted">{t("empty_library_sub")}</p>
          <button className="btn primary lg" onClick={() => go("/add")}>
            {t("add_first")}
          </button>
        </div>
      )}
      <div className="materials">
        {shown?.map((m) => <MaterialCard key={m.id} m={m} cards={cards.filter((c) => c.materialId === m.id).length} />)}
      </div>
    </div>
  );
}
