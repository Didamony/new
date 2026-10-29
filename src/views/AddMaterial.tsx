import { useEffect, useRef, useState } from "react";
import { Camera, FileText, ImagePlus, Sparkles, Upload, X } from "lucide-react";
import { EMOJIS } from "../components/MaterialCard";
import { go, toast } from "../components/ui";
import { extractPdf, imageFileToPart, MAX_IMAGE_PAGES, openPdf, partToSrc, type PdfDoc } from "../lib/ingest";
import { num, useT } from "../lib/i18n";
import { saveMaterial, uid } from "../lib/store";
import type { ImagePart, Material, SourceKind } from "../lib/types";
import { SOURCES } from "./Home";

type Src = "pdf" | "camera" | "images" | "text";

export default function AddMaterial({ initial }: { initial?: string }) {
  const { t, lang } = useT();
  const [src, setSrc] = useState<Src>((SOURCES.some((s) => s.key === initial) ? initial : "pdf") as Src);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [images, setImages] = useState<ImagePart[]>([]);
  const [pdf, setPdf] = useState<{ doc: PdfDoc; name: string; pages: number } | null>(null);
  const [range, setRange] = useState({ from: 1, to: 1 });
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initial && SOURCES.some((s) => s.key === initial)) setSrc(initial as Src);
  }, [initial]);

  // open the picker straight away when arriving from a quick-start button
  useEffect(() => {
    const ref = initial === "camera" ? cameraRef : initial === "images" ? galleryRef : initial === "pdf" ? pdfRef : null;
    ref?.current?.click();
  }, [initial]);

  async function addImages(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    const room = MAX_IMAGE_PAGES - images.length;
    setBusy({ done: 0, total: Math.min(room, list.length) });
    const parts: ImagePart[] = [];
    for (const f of list.slice(0, room)) {
      parts.push(await imageFileToPart(f));
      setBusy({ done: parts.length, total: Math.min(room, list.length) });
    }
    setImages((prev) => [...prev, ...parts]);
    if (!title) setTitle(list[0].name.replace(/\.[^.]+$/, "").slice(0, 60));
    setBusy(null);
  }

  async function addPdf(file: File) {
    try {
      setBusy({ done: 0, total: 1 });
      const doc = await openPdf(file);
      setPdf({ doc, name: file.name, pages: doc.numPages });
      setRange({ from: 1, to: Math.min(doc.numPages, 60) });
      if (!title) setTitle(file.name.replace(/\.pdf$/i, "").slice(0, 60));
    } catch {
      toast("PDF ✗");
    } finally {
      setBusy(null);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const files = Array.from(e.dataTransfer.files);
    const p = files.find((f) => f.type === "application/pdf");
    if (p) {
      setSrc("pdf");
      addPdf(p);
    } else if (files.some((f) => f.type.startsWith("image/"))) {
      setSrc("images");
      addImages(files);
    }
  }

  const ready =
    (src === "text" && text.trim().length > 20) ||
    ((src === "camera" || src === "images") && images.length > 0) ||
    (src === "pdf" && pdf !== null);

  async function save() {
    if (!ready) return toast(t("need_content"));
    const kind: SourceKind = src === "pdf" ? "pdf" : src === "text" ? "text" : "images";
    const m: Material = {
      id: uid(),
      title: title.trim() || text.trim().split("\n")[0].slice(0, 50) || t("appName"),
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      kind,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (src === "text") m.text = text.trim();
    if (src === "camera" || src === "images") m.images = images;
    if (src === "pdf" && pdf) {
      const from = Math.max(1, Math.min(range.from, pdf.pages));
      const to = Math.max(from, Math.min(range.to, pdf.pages));
      setBusy({ done: 0, total: to - from + 1 });
      try {
        const r = await extractPdf(pdf.doc, from, to, (done, total) => setBusy({ done, total }));
        m.text = r.text;
        m.images = r.images;
        m.pageInfo = `${pdf.name} · ${from}–${to}`;
      } catch {
        setBusy(null);
        return toast("PDF ✗");
      }
    }
    await saveMaterial(m);
    setBusy(null);
    go(`/m/${m.id}`);
  }

  return (
    <div className="page" onDragOver={(e) => (e.preventDefault(), setDrag(true))} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
      <h1 className="h1">{t("add_title")}</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        {t("add_sub")}
      </p>

      <div className="sources" style={{ margin: "18px 0" }}>
        {SOURCES.map((s) => (
          <button key={s.key} className={"source" + (src === s.key ? " on" : "")} onClick={() => setSrc(s.key)}>
            <div className={"ic " + s.tone}>
              <s.icon size={22} />
            </div>
            <b>{t(s.title)}</b>
            <span>{t(s.sub)}</span>
          </button>
        ))}
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files && addImages(e.target.files).then(() => (e.target.value = ""))} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addImages(e.target.files).then(() => (e.target.value = ""))} />
      <input ref={pdfRef} type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && addPdf(e.target.files[0])} />

      <div className="card stack">
        <div>
          <label className="label" htmlFor="title">
            {t("title_label")}
          </label>
          <input id="title" className="input" dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("title_ph")} />
        </div>

        {src === "text" && (
          <div>
            <textarea className="textarea" dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("text_ph")} />
            <div className="small muted" style={{ marginTop: 4 }}>
              {t("chars", { n: num(text.length, lang) })}
            </div>
          </div>
        )}

        {src === "pdf" &&
          (pdf ? (
            <div className="stack">
              <div className="row">
                <div className="ic tone-primary" style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center" }}>
                  <FileText size={22} />
                </div>
                <div className="grow">
                  <b dir="auto" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {pdf.name}
                  </b>
                  <span className="small muted">{t("pdf_pages", { n: num(pdf.pages, lang) })}</span>
                </div>
                <button className="icon-btn" aria-label={t("remove")} onClick={() => setPdf(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="row wrap">
                <span className="label" style={{ margin: 0 }}>
                  {t("pages")}:
                </span>
                <span className="small muted">{t("from")}</span>
                <input className="input" type="number" min={1} max={pdf.pages} style={{ width: 90 }} value={range.from} onChange={(e) => setRange({ ...range, from: +e.target.value })} />
                <span className="small muted">{t("to")}</span>
                <input className="input" type="number" min={1} max={pdf.pages} style={{ width: 90 }} value={range.to} onChange={(e) => setRange({ ...range, to: +e.target.value })} />
              </div>
              <div className="small muted">{t("pdf_scanned_note", { n: num(MAX_IMAGE_PAGES, lang) })}</div>
            </div>
          ) : (
            <div className={"dropzone" + (drag ? " drag" : "")}>
              <Upload size={34} className="muted" />
              <p className="muted">PDF</p>
              <button className="btn primary" onClick={() => pdfRef.current?.click()}>
                <FileText size={18} /> {t("pick_pdf")}
              </button>
            </div>
          ))}

        {(src === "camera" || src === "images") && (
          <div className="stack">
            {images.length === 0 ? (
              <div className={"dropzone" + (drag ? " drag" : "")}>
                {src === "camera" ? <Camera size={34} className="muted" /> : <ImagePlus size={34} className="muted" />}
                <div className="row wrap" style={{ justifyContent: "center", marginTop: 12 }}>
                  <button className="btn primary" onClick={() => cameraRef.current?.click()}>
                    <Camera size={18} /> {t("take_photo")}
                  </button>
                  <button className="btn" onClick={() => galleryRef.current?.click()}>
                    <ImagePlus size={18} /> {t("pick_images")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="thumbs">
                  {images.map((img, i) => (
                    <div key={i} className="thumb">
                      <img src={partToSrc(img)} alt="" />
                      <span>{num(i + 1, lang)}</span>
                      <button aria-label={t("remove")} onClick={() => setImages(images.filter((_, j) => j !== i))}>
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="row wrap">
                  <button className="btn sm" onClick={() => cameraRef.current?.click()} disabled={images.length >= MAX_IMAGE_PAGES}>
                    <Camera size={16} /> {t("take_photo")}
                  </button>
                  <button className="btn sm" onClick={() => galleryRef.current?.click()} disabled={images.length >= MAX_IMAGE_PAGES}>
                    <ImagePlus size={16} /> {t("add_more_photos")}
                  </button>
                  <span className="small muted">
                    {t("photos_count", { n: num(images.length, lang) })} / {num(MAX_IMAGE_PAGES, lang)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {busy && (
          <div className="stack" style={{ gap: 6 }}>
            <div className="row small muted">
              <span className="spinner" /> {t("processing")} {busy.total > 1 && `${num(busy.done, lang)}/${num(busy.total, lang)}`}
            </div>
            <div className="progress">
              <div style={{ width: `${(busy.done / Math.max(1, busy.total)) * 100}%` }} />
            </div>
          </div>
        )}

        <button className="btn primary lg block" disabled={!ready || !!busy} onClick={save}>
          <Sparkles size={18} /> {t("save_material")}
        </button>
      </div>
    </div>
  );
}
