import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ImagePart } from "./types";

/** pdf.js is large, so it is only loaded when a PDF is actually opened. */
async function loadPdfjs() {
  const [lib, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  return lib;
}

/** Max pages sent as images (scanned PDFs, camera shots) per material. */
export const MAX_IMAGE_PAGES = 20;
const MAX_SIDE = 1600;

export type PdfDoc = PDFDocumentProxy;

export async function openPdf(file: File): Promise<PdfDoc> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data }).promise;
}

export interface PdfResult {
  text?: string;
  images?: ImagePart[];
}

/**
 * Extracts text from the selected pages. If the pages have (almost) no text
 * layer — a scanned book — they are rendered to images instead so Claude can read them.
 */
export async function extractPdf(
  doc: PdfDoc,
  from: number,
  to: number,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfResult> {
  const total = to - from + 1;
  const pages: string[] = [];
  let chars = 0;
  for (let p = from; p <= to; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items) {
      if ("str" in item) line += item.str + (item.hasEOL ? "\n" : " ");
    }
    const clean = line.replace(/[ \t]+/g, " ").trim();
    chars += clean.length;
    pages.push(`--- [${p}] ---\n${clean}`);
    onProgress?.(p - from + 1, total);
  }

  if (chars / total >= 80) return { text: pages.join("\n\n") };

  // scanned: render pages
  const images: ImagePart[] = [];
  const last = Math.min(to, from + MAX_IMAGE_PAGES - 1);
  for (let p = from; p <= last; p++) {
    const page = await doc.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, MAX_SIDE / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    images.push(canvasToPart(canvas));
    onProgress?.(p - from + 1, last - from + 1);
  }
  return { images };
}

function canvasToPart(canvas: HTMLCanvasElement): ImagePart {
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}

/** Downscales a photo so it is cheap to send while staying readable. */
export async function imageFileToPart(file: File): Promise<ImagePart> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToPart(canvas);
}

export function partToSrc(p: ImagePart) {
  return `data:${p.mediaType};base64,${p.data}`;
}
