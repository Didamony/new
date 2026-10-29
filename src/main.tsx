import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DEMO, seedDemo } from "./lib/demo";
import "./styles.css";

if (DEMO) seedDemo();
else if ("serviceWorker" in navigator && import.meta.env.PROD) {
  // the worker sits at the site root so it can also cache the website
  navigator.serviceWorker.register(new URL("../sw.js", location.href), { scope: new URL("../", location.href).pathname }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
