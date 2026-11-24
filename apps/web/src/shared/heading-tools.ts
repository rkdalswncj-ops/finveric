import { createContext, type ReactNode } from "react";

/** 화면 제목 옆에 앱이 공통으로 표시하는 상태나 도구. */
export const HeadingTools = createContext<ReactNode>(null);
