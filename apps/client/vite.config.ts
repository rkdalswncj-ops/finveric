import { finvericVite } from "../../packages/ui/vite.ts";

// 기관 업무와 판매 채널 시연. 배포에서는 같은 도메인의 /client/에서 실행한다.
// 공개 검증 설정은 사이트 루트의 /deployment.json을 auditor와 함께 쓴다.
export default finvericVite({
  port: 5173,
  base: "/client/",
  publicDir: false,
});
