import { finvericVite, sharedPublic } from "../../packages/ui/vite.ts";

// 기관 업무와 판매 채널 시연. 사이트 루트(/)에서 실행한다.
// 공개 검증 설정(deployment*.json)을 빌드 결과의 루트에 넣는다.
export default finvericVite({ port: 5173, publicDir: sharedPublic });
