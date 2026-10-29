import { useEffect } from "react";
import { BookOpen, Crown, Home as HomeIcon, Layers, Plus, RefreshCw, Settings as SettingsIcon, Timer } from "lucide-react";
import { go, ToastHost, useRoute } from "./components/ui";
import { useT } from "./lib/i18n";
import { refreshAccess, useAccount } from "./lib/account";
import { DEMO, demoLangNote } from "./lib/demo";
import { listCards, useLive, useSettings } from "./lib/store";
import { isDue } from "./lib/srs";
import Home from "./views/Home";
import Library from "./views/Library";
import AddMaterial from "./views/AddMaterial";
import MaterialView from "./views/MaterialView";
import Review from "./views/Review";
import Focus from "./views/Focus";
import Settings from "./views/Settings";
import Auth from "./views/Auth";
import Paywall from "./views/Paywall";
import Paid from "./views/Paid";
import Owner from "./views/Owner";
import logo from "./assets/logo.svg";

function useThemeAndDirection() {
  const { theme, lang } = useSettings();
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0c0d19" : "#6d5efc");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = lang === "ar" ? "ذاكرلي — مساعدك الذكي للمذاكرة" : "Zakerly — your smart study buddy";
  }, [lang]);
}

export default function App() {
  useThemeAndDirection();
  const { t } = useT();
  const route = useRoute();
  const section = route[0] ?? "";
  const due = useLive(async () => (await listCards()).filter(isDue).length, ["cards"]) ?? 0;
  const { status } = useAccount();

  // Access gate: sign in first, then free trial, then the monthly subscription.
  if (status.kind === "loading") {
    return (
      <div className="gate">
        <span className="spinner" style={{ width: 36, height: 36, color: "var(--primary)" }} />
      </div>
    );
  }
  if (status.kind === "error") {
    return (
      <div className="gate">
        <div className="gate-card card empty">
          <p>{t("access_error")}</p>
          <button className="btn primary" onClick={() => refreshAccess()}>
            <RefreshCw size={16} /> {t("refresh")}
          </button>
        </div>
      </div>
    );
  }
  if (status.kind === "anon") return <Auth />;
  if (status.kind === "expired" && section !== "paid") return <Paywall blocking />;

  let view;
  switch (section) {
    case "library":
      view = <Library />;
      break;
    case "add":
      view = <AddMaterial initial={route[1]} />;
      break;
    case "m":
      view = <MaterialView key={route[1]} id={route[1]} tool={route[2]} />;
      break;
    case "review":
      view = <Review materialId={route[1]} />;
      break;
    case "focus":
      view = <Focus />;
      break;
    case "settings":
      view = <Settings />;
      break;
    case "upgrade":
      view = <Paywall blocking={false} />;
      break;
    case "paid":
      view = <Paid />;
      break;
    case "owner":
      view = <Owner />;
      break;
    default:
      view = <Home due={due} />;
  }

  const links = [
    { key: "", icon: HomeIcon, label: t("nav_home") },
    { key: "library", icon: BookOpen, label: t("nav_library") },
    { key: "review", icon: Layers, label: t("nav_review"), count: due },
    { key: "focus", icon: Timer, label: t("nav_focus") },
    { key: "settings", icon: SettingsIcon, label: t("nav_settings") },
    ...(status.kind === "admin" ? [{ key: "owner", icon: Crown, label: t("owner_page") }] : []),
  ];
  const active = section === "m" ? "library" : section;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src={logo} alt="" />
          <div>
            <b>{t("appName")}</b>
            <small>{t("tagline")}</small>
          </div>
        </div>
        <button className="btn primary side-add" onClick={() => go("/add")}>
          <Plus size={18} /> {t("add_title")}
        </button>
        {links.map((l) => (
          <button key={l.key} className={"side-link" + (active === l.key ? " active" : "")} onClick={() => go("/" + l.key)}>
            <l.icon size={20} />
            {l.label}
            {!!l.count && <span className="count">{l.count}</span>}
          </button>
        ))}
      </aside>

      <main className="main">
        {DEMO && <div className="demo-note no-print">{demoLangNote()}</div>}
        {view}
      </main>

      <nav className="bottom-nav" aria-label="main">
        {links.slice(0, 2).map(({ key, ...l }) => (
          <NavItem {...l} key={key} to={key} active={active === key} />
        ))}
        <button className="nav-fab" aria-label={t("nav_add")} onClick={() => go("/add")}>
          <Plus size={28} strokeWidth={2.5} />
        </button>
        {links.slice(2, 4).map(({ key, ...l }) => (
          <NavItem {...l} key={key} to={key} active={active === key} />
        ))}
      </nav>
      <ToastHost />
    </div>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  active,
  count,
}: {
  to: string;
  icon: typeof HomeIcon;
  label: string;
  active: boolean;
  count?: number;
}) {
  return (
    <button className={"nav-item" + (active ? " active" : "")} onClick={() => go("/" + to)}>
      <Icon size={22} strokeWidth={active ? 2.4 : 2} />
      {label}
      {!!count && <span className="badge-dot">{count > 99 ? "99+" : count}</span>}
    </button>
  );
}
