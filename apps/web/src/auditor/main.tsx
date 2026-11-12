import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App.tsx";
import "../../../../packages/ui/src/theme.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/auditor">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
