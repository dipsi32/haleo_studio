import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAnalytics } from "./lib/analytics";

initAnalytics();

createRoot(document.getElementById("root")!).render(<App />);

// The app loaded: allow the one-time stale-file reload (index.html) again next time.
setTimeout(() => {
  try {
    sessionStorage.removeItem("haleo:reloaded");
  } catch {
    /* ignore */
  }
}, 5000);
