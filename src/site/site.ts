import "./site.css";

/* Arabic ⇄ English: every translatable element carries its English text in data-en. */

const SETTINGS_KEY = "zakerly.settings"; // shared with the app, so it opens in the same language
const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-en]"));
nodes.forEach((el) => (el.dataset.ar = el.innerHTML));

const titles = { ar: document.title, en: "Zakerly — study smarter, not longer" };
const button = document.getElementById("lang") as HTMLButtonElement;

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function apply(lang: "ar" | "en") {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === "ar" ? "rtl" : "ltr";
  root.dataset.lang = lang;
  nodes.forEach((el) => (el.innerHTML = lang === "en" ? escape(el.dataset.en!) : el.dataset.ar!));
  document.title = titles[lang];
  button.textContent = lang === "ar" ? "English" : "العربية";
}

function save(lang: "ar" | "en") {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, lang }));
  } catch {
    /* storage unavailable */
  }
}

apply(document.documentElement.dataset.lang === "en" ? "en" : "ar");
button.addEventListener("click", () => {
  const next = document.documentElement.lang === "ar" ? "en" : "ar";
  apply(next);
  save(next);
});
