import { useState } from "react";
import { Copy, Download, EllipsisVertical, MonitorDown, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { promptInstall, useInstallKind } from "../lib/install";
import { useT, type TKey } from "../lib/i18n";
import logo from "../assets/logo.svg";
import { toast } from "./ui";

const DISMISS_KEY = "zakerly.installDismissed";
const SHOW_AGAIN_AFTER = 7 * 24 * 3600 * 1000;

function dismissedRecently() {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < SHOW_AGAIN_AFTER;
  } catch {
    return false;
  }
}

type Step = { icon: typeof Share; text: TKey };

/**
 * Tells every visitor how to install the app on their device. `always` shows it
 * even after it was dismissed (used in Settings); it never shows once installed.
 */
export function InstallCard({ always = false }: { always?: boolean }) {
  const { t } = useT();
  const kind = useInstallKind();
  const [hidden, setHidden] = useState(() => !always && dismissedRecently());

  if (kind === "installed" || hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage unavailable */
    }
    setHidden(true);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href.split("#")[0]);
      toast(t("copied"));
    } catch {
      toast(location.href.split("#")[0]);
    }
  }

  const steps: Record<string, Step[]> = {
    ios: [
      { icon: Share, text: "inst_ios_1" },
      { icon: SquarePlus, text: "inst_ios_2" },
      { icon: Smartphone, text: "inst_ios_3" },
    ],
    "ios-other": [
      { icon: Share, text: "inst_iosother_1" },
      { icon: SquarePlus, text: "inst_ios_2" },
      { icon: Smartphone, text: "inst_ios_3" },
    ],
    android: [
      { icon: EllipsisVertical, text: "inst_android_1" },
      { icon: Download, text: "inst_android_2" },
      { icon: Smartphone, text: "inst_ios_3" },
    ],
    desktop: [
      { icon: MonitorDown, text: "inst_desktop_1" },
      { icon: Download, text: "inst_desktop_2" },
    ],
  };

  return (
    <section className="card install-card" aria-label={t("inst_title")}>
      {!always && (
        <button className="icon-btn install-close" aria-label={t("inst_later")} onClick={dismiss}>
          <X size={16} />
        </button>
      )}
      <div className="row" style={{ alignItems: "center" }}>
        <img src={logo} alt="" width={52} height={52} style={{ borderRadius: 14, flexShrink: 0 }} />
        <div className="grow">
          <h2 className="h2">{t("inst_title")}</h2>
          <p className="small muted" style={{ margin: "2px 0 0" }}>
            {t("inst_sub")}
          </p>
        </div>
      </div>

      {kind === "prompt" && (
        <button
          className="btn primary lg block"
          onClick={async () => {
            if (await promptInstall()) toast(t("inst_done"));
          }}
        >
          <Download size={18} /> {t("install")}
        </button>
      )}

      {kind === "in-app" && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="alert info">{t("inst_inapp")}</div>
          <ol className="install-steps">
            <li>
              <span className="install-ic">
                <EllipsisVertical size={18} />
              </span>
              {t("inst_inapp_1")}
            </li>
            <li>
              <span className="install-ic">
                <Share size={18} />
              </span>
              {t("inst_inapp_2")}
            </li>
          </ol>
          <button className="btn" onClick={copyLink}>
            <Copy size={16} /> {t("inst_copy")}
          </button>
        </div>
      )}

      {steps[kind] && (
        <ol className="install-steps">
          {steps[kind].map((s) => (
            <li key={s.text}>
              <span className="install-ic">
                <s.icon size={18} />
              </span>
              {t(s.text)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
