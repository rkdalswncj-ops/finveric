import React from "react";
import { createRoot } from "react-dom/client";
import { Entry } from "./Entry.tsx";
import "../shared/theme.css";

// 사이트 루트(/)의 진입 화면. client 빌드의 두 번째 엔트리다.
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Entry />
  </React.StrictMode>,
);
