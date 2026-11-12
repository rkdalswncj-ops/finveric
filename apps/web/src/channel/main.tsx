import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App.tsx";
import "../../../../packages/ui/src/theme.css";

// 증권사 앱 예시(/channel/). FINVERIC API로 만든 고객 화면이다.
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/channel">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
