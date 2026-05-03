import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logError } from "@shared/lib/errorLogger";
import ErrorBoundary from "@shared/lib/ErrorBoundary";

window.addEventListener("error", (e) => {
  logError(e.error ?? e.message, `uncaught: ${e.filename}:${e.lineno}`);
});

window.addEventListener("unhandledrejection", (e) => {
  logError(e.reason, "unhandledrejection");
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
