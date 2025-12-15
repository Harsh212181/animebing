// index.tsx — Optimized for Best Performance
import "./src/index.css"; // ✅ ADDED THIS LINE - Tailwind CSS import
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./src/components/ErrorBoundary";
import Spinner from "./src/components/Spinner";

// Mount point
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

const root = ReactDOM.createRoot(rootElement);

// 🚀 Non-blocking React render (improves TBT & FCP)
const startApp = () => {
  root.render(
    <ErrorBoundary>
      <Suspense fallback={<Spinner />}>
        <App />
      </Suspense>
    </ErrorBoundary>
  );
};

// ⏳ Load React AFTER the browser is idle → faster LCP
if ("requestIdleCallback" in window) {
  requestIdleCallback(startApp);
} else {
  setTimeout(startApp, 1);
}