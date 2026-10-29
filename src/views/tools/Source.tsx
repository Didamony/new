import { partToSrc } from "../../lib/ingest";
import { num, useT } from "../../lib/i18n";
import type { Material } from "../../lib/types";

export function Source({ m }: { m: Material }) {
  const { t, lang } = useT();
  return (
    <div className="card stack">
      <div className="row between wrap">
        <h2 className="h2">{t("tool_source")}</h2>
        {m.pageInfo && <span className="chip" dir="auto">{m.pageInfo}</span>}
      </div>
      {m.images && m.images.length > 0 && (
        <div className="thumbs" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
          {m.images.map((img, i) => (
            <a key={i} className="thumb" href={partToSrc(img)} target="_blank" rel="noreferrer">
              <img src={partToSrc(img)} alt="" />
              <span>{num(i + 1, lang)}</span>
            </a>
          ))}
        </div>
      )}
      {m.text && (
        <>
          <div className="small muted">{t("chars", { n: num(m.text.length, lang) })}</div>
          <div className="source-text" dir="auto">
            {m.text}
          </div>
        </>
      )}
    </div>
  );
}
