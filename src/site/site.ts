import "./site.css";

type Lang = "ar" | "en";
const SETTINGS_KEY = "zakerly.settings"; // shared with the app, so it opens in the same language
const lang = (): Lang => (document.documentElement.lang === "en" ? "en" : "ar");

/* ---------------- Arabic ⇄ English ---------------- */

const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-en]"));
nodes.forEach((el) => (el.dataset.ar = el.innerHTML));
const titles = { ar: document.title, en: "Zakerly — study smarter, not longer" };
const langButton = document.getElementById("lang") as HTMLButtonElement;

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function applyLang(l: Lang) {
  const root = document.documentElement;
  root.lang = l;
  root.dir = l === "ar" ? "rtl" : "ltr";
  root.dataset.lang = l;
  nodes.forEach((el) => (el.innerHTML = l === "en" ? escape(el.dataset.en!) : el.dataset.ar!));
  document.title = titles[l];
  langButton.textContent = l === "ar" ? "English" : "العربية";
}

function saveLang(l: Lang) {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, lang: l }));
  } catch {
    /* storage unavailable */
  }
}

applyLang(document.documentElement.dataset.lang === "en" ? "en" : "ar");
langButton.addEventListener("click", () => {
  const next = lang() === "ar" ? "en" : "ar";
  applyLang(next);
  saveLang(next);
  if (!modal.hidden) renderInstall();
});

/* ---------------- scroll-in animations ---------------- */

const reveal = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );
  reveal.forEach((el) => io.observe(el));
} else {
  reveal.forEach((el) => el.classList.add("in"));
}
requestAnimationFrame(() => document.documentElement.classList.add("loaded"));

/* ---------------- install guide ---------------- */

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let deferred: InstallEvent | null = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as InstallEvent;
  if (!modal.hidden) renderInstall();
});

type Kind = "ios" | "ios-other" | "in-app" | "android" | "desktop";

function detect(): Kind {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (/FBAN|FBAV|Instagram|WhatsApp|Snapchat|TikTok|Line\/|Twitter|; wv\)/i.test(ua)) return "in-app";
  if (ios) return /CriOS|FxiOS|EdgiOS/i.test(ua) ? "ios-other" : "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

const icons = {
  share: '<path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  plus: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  dots: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
};
const icon = (k: keyof typeof icons) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[k]}</svg>`;

const T = {
  ar: {
    sub: "١٠ ثواني ويبقى على الشاشة الرئيسية زي أي تطبيق.",
    ios: [
      ["share", "دوس على زرار <b>المشاركة</b> تحت في Safari (المربع اللي طالع منه سهم)."],
      ["plus", "انزل شوية واختار <b>«إضافة إلى الشاشة الرئيسية»</b> (Add to Home Screen)."],
      ["check", "دوس <b>«إضافة»</b> (Add). هتلاقي ذاكرلي على الشاشة 🎉"],
    ],
    iosOther: [
      ["share", "دوس على زرار <b>المشاركة</b> في شريط العنوان فوق."],
      ["plus", "اختار <b>«إضافة إلى الشاشة الرئيسية»</b> (Add to Home Screen)."],
      ["check", "دوس <b>«إضافة»</b>. هتلاقي ذاكرلي على الشاشة 🎉"],
    ],
    android: [
      ["dots", "دوس على القائمة <b>⋮</b> فوق في Chrome."],
      ["download", "اختار <b>«تثبيت التطبيق»</b> أو «إضافة إلى الشاشة الرئيسية»."],
      ["check", "دوس <b>«تثبيت»</b>. هتلاقي ذاكرلي على الشاشة 🎉"],
    ],
    desktop: [
      ["monitor", "دوس على أيقونة <b>التثبيت</b> في آخر شريط العنوان، أو افتح قائمة المتصفح."],
      ["download", "اختار <b>«تثبيت ذاكرلي»</b> (Install)."],
    ],
    inApp: "إنت فاتح اللينك من جوه تطبيق (واتساب/إنستجرام/فيسبوك)، ومنه مينفعش التنزيل.",
    inAppSteps: [
      ["dots", "دوس على القائمة <b>(⋮ أو …)</b> فوق."],
      ["compass", "اختار <b>«فتح في المتصفح»</b> (Open in Safari / Chrome)، وهتلاقي الشرح هناك."],
    ],
    install: "تثبيت ذاكرلي",
    copy: "انسخ اللينك",
    copied: "اتنسخ ✓",
  },
  en: {
    sub: "Ten seconds and it's on your home screen like any app.",
    ios: [
      ["share", "Tap the <b>Share</b> button at the bottom of Safari (the square with an arrow)."],
      ["plus", "Scroll down and choose <b>“Add to Home Screen”</b>."],
      ["check", "Tap <b>“Add”</b>. Zakerly is now on your home screen 🎉"],
    ],
    iosOther: [
      ["share", "Tap the <b>Share</b> button in the address bar."],
      ["plus", "Choose <b>“Add to Home Screen”</b>."],
      ["check", "Tap <b>“Add”</b>. Zakerly is now on your home screen 🎉"],
    ],
    android: [
      ["dots", "Tap the <b>⋮</b> menu at the top of Chrome."],
      ["download", "Choose <b>“Install app”</b> or “Add to Home screen”."],
      ["check", "Tap <b>“Install”</b>. Zakerly is now on your home screen 🎉"],
    ],
    desktop: [
      ["monitor", "Click the <b>install</b> icon at the end of the address bar, or open the browser menu."],
      ["download", "Choose <b>“Install Zakerly”</b>."],
    ],
    inApp: "You opened this link inside an app (WhatsApp/Instagram/Facebook), which can't install apps.",
    inAppSteps: [
      ["dots", "Tap the menu <b>(⋮ or …)</b> at the top."],
      ["compass", "Choose <b>“Open in Safari / Chrome”</b> and you'll find the steps there."],
    ],
    install: "Install Zakerly",
    copy: "Copy link",
    copied: "Copied ✓",
  },
} as const;

const modal = document.getElementById("install") as HTMLElement;
const body = document.getElementById("install-body") as HTMLElement;
const sub = document.getElementById("install-sub") as HTMLElement;
const pointDown = document.getElementById("point-down") as HTMLElement;

function steps(list: readonly (readonly [string, string])[]) {
  return `<ol class="i-steps">${list
    .map(([ic, text], i) => `<li style="--d:${i * 90}ms"><span class="i-ic">${icon(ic as keyof typeof icons)}</span><span>${text}</span></li>`)
    .join("")}</ol>`;
}

function renderInstall() {
  const t = T[lang()];
  const kind = detect();
  sub.textContent = t.sub;
  let html = "";
  if (deferred) {
    html += `<button class="btn btn-primary btn-lg block" id="do-install" type="button">${icon("download")} ${t.install}</button>`;
  }
  if (kind === "in-app") {
    html += `<div class="note">${t.inApp}</div>${steps(t.inAppSteps)}<button class="btn btn-ghost block" id="copy-link" type="button">${t.copy}</button>`;
  } else if (!deferred) {
    html += steps(kind === "ios" ? t.ios : kind === "ios-other" ? t.iosOther : kind === "android" ? t.android : t.desktop);
  }
  body.innerHTML = html;
  // on iPhone Safari the Share button is at the bottom of the screen: point at it
  pointDown.hidden = kind !== "ios" || !!deferred;
  modal.querySelector(".sheet")!.classList.toggle("has-arrow", !pointDown.hidden);

  document.getElementById("do-install")?.addEventListener("click", async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    if (outcome === "accepted") location.href = "./app/";
    else renderInstall();
  });
  document.getElementById("copy-link")?.addEventListener("click", async (e) => {
    const link = location.href.split("#")[0];
    try {
      await navigator.clipboard.writeText(link);
      (e.currentTarget as HTMLElement).textContent = t.copied;
    } catch {
      prompt("", link);
    }
  });
}

let lastFocus: HTMLElement | null = null;

function openInstall() {
  lastFocus = document.activeElement as HTMLElement;
  renderInstall();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => modal.classList.add("open"));
  (modal.querySelector(".sheet-close") as HTMLElement).focus();
}

function closeInstall() {
  modal.classList.remove("open");
  document.body.style.overflow = "";
  setTimeout(() => (modal.hidden = true), 250);
  lastFocus?.focus();
}

document.querySelectorAll<HTMLAnchorElement>(".open-app").forEach((a) =>
  a.addEventListener("click", (e) => {
    e.preventDefault();
    openInstall();
  }),
);
modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeInstall));
addEventListener("keydown", (e) => e.key === "Escape" && !modal.hidden && closeInstall());

/* The worker sits at the site root, so the website and the app both work offline and can be installed. */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
