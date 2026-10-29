import { useSyncExternalStore } from "react";

/** How this visitor can install the app, so we can show them the right steps. */
export type InstallKind =
  | "installed" // already running from the home screen
  | "prompt" // Chrome/Edge/Android: the browser can install with one tap
  | "ios" // iPhone/iPad Safari: Share → Add to Home Screen
  | "ios-other" // iPhone in Chrome/Firefox: same steps from their share menu
  | "in-app" // WhatsApp/Instagram/Facebook… browsers can't install: open in Safari/Chrome
  | "android" // Android without the prompt (yet): browser menu → Install app
  | "desktop"; // other desktop browsers

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  notify();
});
window.addEventListener("appinstalled", () => {
  installedNow = true;
  deferred = null;
  notify();
});

function detect(): InstallKind {
  const ua = navigator.userAgent;
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (standalone || installedNow) return "installed";
  if (deferred) return "prompt";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (/FBAN|FBAV|Instagram|WhatsApp|Snapchat|TikTok|Line\/|Twitter|; wv\)/i.test(ua)) return "in-app";
  if (ios) return /CriOS|FxiOS|EdgiOS/i.test(ua) ? "ios-other" : "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

let snapshot = detect();
subs.add(() => (snapshot = detect()));

export function useInstallKind(): InstallKind {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => snapshot,
  );
}

/** Shows the browser's own install dialog (only when kind is "prompt"). */
export async function promptInstall() {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  notify();
  return outcome === "accepted";
}
