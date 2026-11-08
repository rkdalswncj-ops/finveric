# FINVERIC · 핀베릭

펀드 판매절차 공동 검증 플랫폼.

[GitHub 비공개 저장소](https://github.com/yhc125/finveric) · 프로젝트 폴더: `finveric`

펀드 판매 과정의 조건 충족과 처리 이력을 자산운용사·판매 증권사·고객·검증자가 함께 확인하는 B2B 플랫폼 구상이다. 진단·재진단·설명 확인·서명을 같은 판매 건으로 연결한다. ZKP는 고정한 답변의 계산 결과를 검증한다. 스마트컨트랙트는 증명과 필수 기록을 검사한다. 고객은 받은 증빙을 판매사 API 없이 원장과 대조한다.

현재는 기획 문서와 클릭형 펀드 HTML 시안이 있다. 새 펀드 MVP의 실제 ZKP·원장·API 연결은 아직 구현하지 않았다. 최신 업무 규칙과 완료 기준은 펀드 PRD를 따른다. 기존 ELS HTML과 아키텍처는 이전 설계 자료다.

- [펀드 화면 시안 · 클릭형 HTML](docs/fund-ui-prototype.html)
- [최신 MVP PRD](docs/fund-sales-verification-prd.md)
- [펀드 UI/UX 레퍼런스 조사](docs/fund-ui-ux-references.md)
- [기본 디자인 규격과 고정한 Toss 레퍼런스](DESIGN.md)
- [Notion 문제 정의 원문](https://example.invalid)
- [이전 ELS UI 시안](docs/ui-ux-prototype.html)
- [이전 ELS 기술 아키텍처](docs/architecture.html)
- [이전 ELS 공동 청약 설계 보관본](docs/archive/2026-11-08-els-shared-subscription-prd.md)

## 참여자와 역할

| 참여자 | 역할 | 기말 MVP |
| --- | --- | --- |
| 투자자 | 상품 확인, 진단, 설명 확인, 서명, 본인 기록 검증 | 가상 고객 한 명, 같은 판매 세션의 진단 세 회차 |
| 자산운용사 | 상품·클래스·설명서 버전 관리 | 가상 펀드 한 종, 온라인 클래스 한 개, 문서 v1 |
| 판매 증권사 | 고객 확인, 진단 규칙 관리, 판매 절차, 원본 관리 | 진단 규칙 v1과 별도 테스트 키 |
| 준법 담당자 | 재진단 경고와 증빙 누락 확인, 추가 검토 | 세 번째 진단 뒤 필요한 검토 승인 |
| 외부 검증자 | 지정 원장에서 버전·증명·이력 대조 | 고객 파일과 RPC를 쓰는 독립 검증 화면 |
| 기존 펀드 업무 인프라 | 매입 요청과 자금·기준가격·좌수 결과 처리 | 별도 테스트 키로 모의 매입 결과 전달 |

실제 기관의 참여와 운영 권한은 설계 가정이다. 감독기관의 공식 승인이나 실제 펀드넷 연동은 포함하지 않는다. 해시·ZKP는 원본 보관을 대체하지 않는다. MVP는 고객이 내려받은 가상 원본으로 변경 여부를 확인한다. 별도 보관 서비스와 장기 접근 보장은 후속 범위다.

## 개발 스택

| 영역 | 선택 |
| --- | --- |
| 개발 환경 | Node.js 22.12 이상 22.x, npm 10 workspaces, TypeScript 5.9. 설치 버전은 스캐폴딩 때 lockfile로 고정한다. |
| 웹 · `apps/web` | React 19, Vite 8, React Router 7. 공통 컴포넌트는 shadcn/ui와 Tailwind CSS를 쓴다. 테마는 CSS 변수로 정의하고 화면별 스타일은 CSS Modules로 관리한다. 폼 상태는 React에서 관리한다. |
| API · `apps/api` | Fastify 5 REST와 JSON Schema. 서버에서 viem 2로 거래를 제출한다. 독립 검증 화면은 viem으로 RPC에서 직접 읽는다. |
| ZKP · `circuits` | Circom 2.2.3과 snarkjs 0.7.6. Groth16·BN254로 증명한다. circomlib와 circomlibjs의 Poseidon을 회로와 서버에서 같은 입력 순서로 사용한다. |
| 원장 · `contracts` | Solidity 0.8.30, Foundry 1.4.4. forge로 원장과 생성된 Verifier를 빌드하고 테스트·배포한다. anvil로 실행하고 cast로 결과를 확인한다. |
| 저장 | 가상 답변과 증명 입력은 API에 임시 보관한다. 고객은 원본 묶음과 검증 영수증을 내려받는다. 원장 상태와 로그에 답변·총점·비공개 임의값·실제 개인정보를 넣지 않는다. 서버 재시작 복구는 구현 단계에서 정한다. |
| 테스트 | forge test로 단계 통제와 증명 재사용 거절을 검증한다. Node.js 테스트 러너와 Fastify inject로 API를 검증한다. Playwright로 가입과 독립 검증을 확인한다. |

기존 스택 선택은 유지한다. 개발 중에는 Vite의 프록시로 `/api`를 Fastify에 연결한다. 증명은 같은 Node 프로세스에서 생성한다. 미충족 답변도 결과가 false인 유효한 증명을 만들어 진단 이력에 남긴다. 최종 가입 조건 검증에는 충족 결과와 필수 확인 기록이 필요하다. 이는 구현 계획이다.

## 시연 환경과 순서

- **배포 시연.** Vercel 웹, Render API, Sepolia 컨트랙트를 연결한다. 한 웹사이트의 사이드 탭으로 사용자·관리자 화면을 바꾼다. 관리자에서 운용사·증권사·검증자 역할을 선택한다.
- **실제 처리.** ZKP 생성·검증, 원장 거래, 영수증·이벤트 조회, 원본 대조를 실제로 실행한다. 역할별 테스트 키는 서버에 둔다. 가상 고객의 확인·서명도 모의 키로 시연한다.
- **모의 처리.** 본인인증·전자서명·자금 이동·펀드 매입 결과를 모의 처리로 표시한다. 가입 조건 검증 완료와 모의 매입 결과 반영을 구분한다.
- **시연 순서.** 상품·규칙 등록 → 진단 세 회차 → 필수 기록 누락 거절 → 정상 조건 검증 → 모의 매입 결과 → 사후 변경 탐지 → 고객의 독립 검증을 보여준다. [시연 수치와 기대 결과](docs/fund-sales-verification-prd.md#기말-시연-시나리오)
- **로컬 리허설.** 같은 코드를 Vite·Fastify·Anvil로 실행한다. 실제 배포에서는 외부 접속과 RPC·API 연결을 확인한다.

펀드 HTML 시안은 상품 탐색, 진단, 기관 검토, 모의 처리 로그, 파일 지문 대조를 제공한다. 실제 ZKP나 Sepolia 거래에 연결되지 않았다. 모든 상태는 브라우저 메모리에 있다. 새로고침하면 예시 상태로 돌아간다. 디자인 토큰과 고정한 레퍼런스 원본은 유지했다.

시안은 `python3 -m http.server 49174 --bind 127.0.0.1 --directory docs`로 연다. `http://127.0.0.1:49174/fund-ui-prototype.html`에서 사용한다. 상품 탐색 배치는 `?variant=A`, `?variant=B`, `?variant=C`로 비교한다. [상품 탐색 캡처](docs/screenshots/fund-customer.png) · [기관 검토 캡처](docs/screenshots/fund-review.png) · [처리 로그 캡처](docs/screenshots/fund-chain.png) · [독립 검증 캡처](docs/screenshots/fund-verify.png)

## 개발 참고

[shadcn/ui Vite 설정](https://ui.shadcn.com/docs/installation/vite) · [Foundry](https://www.getfoundry.sh/) · [snarkjs Solidity Verifier 생성](https://github.com/iden3/snarkjs#25-turn-the-verifier-into-a-smart-contract) · [Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite) · [Render](https://render.com/docs/free#spinning-down-on-idle)
