import { resolve } from "node:path";

/**
 * 증명 키·배포 설정 같은 실행 파일의 기준 디렉터리.
 * 로컬에서는 저장소 루트(현재 작업 디렉터리)다.
 * Vercel 함수는 번들에 넣은 파일을 쓰도록 FINVERIC_ROOT에 함수 디렉터리를 지정한다.
 */
export const fromRoot = (path: string) =>
  resolve(process.env.FINVERIC_ROOT ?? process.cwd(), path);

/**
 * 증명 키 디렉터리의 파일. FINVERIC_ZK_DIR이 있으면 그 디렉터리, 없으면 circuits/build다.
 * 검사와 개발은 FINVERIC_ZK_DIR로 시연 키와 다른 디렉터리를 쓸 수 있다.
 */
export const zkPath = (name: string) =>
  process.env.FINVERIC_ZK_DIR
    ? resolve(process.env.FINVERIC_ZK_DIR, name)
    : fromRoot(`circuits/build/${name}`);
export const ZK_FILES = {
  zkey: "suitability.zkey",
  wasm: "suitability_js/suitability.wasm",
} as const;
