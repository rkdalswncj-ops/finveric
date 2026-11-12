import { finvericVite } from "../../packages/ui/vite.ts";

// 감독기관·외부 검증자 화면. 배포에서는 같은 도메인의 /auditor/에서 실행한다.
// 공개 검증 설정은 사이트 루트의 /deployment.json을 client와 함께 쓴다.
export default finvericVite({
  port: 5174,
  base: "/auditor/",
  publicDir: false,
});
