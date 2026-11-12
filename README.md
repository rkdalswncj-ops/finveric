# FINVERIC · 핀베릭

펀드 판매절차 공동 검증 플랫폼.

[GitHub 비공개 저장소](https://github.com/yhc125/finveric) · 프로젝트 폴더: `finveric`

펀드 판매 과정과 처리 이력을 자산운용사·판매 증권사·검증자가 함께 확인하는 B2B·B2G 플랫폼이다. 투자자는 FINVERIC 화면을 직접 쓰지 않는다. 투자자는 증권사 앱에서 가입하고, 그 앱이 FINVERIC API에 연결한다. 투자성향 진단, 설명 확인, 추가 위험 확인을 같은 가입 건으로 연결한다. 스마트컨트랙트는 답변 커밋먼트, 실제 ZKP와 필요한 동의를 한 거래에서 검사하고 가입을 확정한다. 고객이 받은 증빙은 판매사 API 없이 원장과 대조할 수 있다.

웹은 두 앱이다. **client 앱**은 운용사·증권사·준법 담당자의 업무 화면과 판매 채널 시연을 제공한다. **auditor 앱**은 감독기관·외부 검증자의 독립 검증 화면이다. [결정 기록](docs/adr/0001-web-apps-by-audience.md)

React 웹, Fastify API, Circom 회로, Solidity 원장을 사용한다. 원장 v4에서 가상 펀드 세 종의 가입을 지원한다. 진단 규칙 v3은 안정형·균형형·적극형을 분류한다. 투자성향이 직접 고른 펀드의 기준보다 낮으면 추가 안내를 확인한 뒤 가입할 수 있다. 최종 확인 전에는 임시 기록을 사용하고, 가입을 중단하면 폐기한다. 로컬 시연은 Anvil에서 실행한다. 외부 시연은 Vercel과 Sepolia로 배포한다. 업무 규칙과 완료 기준은 [펀드 PRD](docs/prd.md)를 따른다.

## 빠른 시작

### Docker

Docker만 있으면 된다. Anvil, API, client, auditor를 한 컨테이너에서 실행한다.

```bash
docker compose up --build
```

첫 실행은 이미지를 만들고, 증명 키를 만들고, 컨트랙트를 배포하므로 몇 분 걸린다. 컨트랙트가 준비되면 `docker compose ps`의 상태가 `healthy`로 바뀐다. 이 상태는 [health API](http://localhost:3001/api/health)가 RPC·원장·저장소를 점검한 결과다. 그 뒤 [client 앱](http://localhost:5173/client/)과 [auditor 앱](http://localhost:5174/auditor/)을 연다. 원장 상태와 판매 기록은 Docker 볼륨에 남는다. `docker compose down`으로 멈춘다. `docker compose down -v`는 기록까지 지운다.

### Node

Node.js 22.12 이상 22.x와 npm 10을 사용한다. Foundry와 Circom은 npm 패키지에 포함했다. 별도 전역 설치는 필요 없다. Solidity 컴파일러는 첫 빌드 때 다운로드한다.

```bash
npm ci
npm run dev
```

[client 앱 열기](http://127.0.0.1:5173/client/) · [auditor 앱 열기](http://127.0.0.1:5174/auditor/). 첫 실행은 증명 키를 만들고 컨트랙트를 배포하므로 시간이 더 걸린다. 기본 포트는 client 5173, auditor 5174, API 3001, Anvil 8545다. 먼저 client 앱의 **상품·문서 관리**에서 세 상품의 설명서 v1과 진단 규칙 v3을 등록한다. **판매 채널 시연**의 펀드 찾기에서 가입을 시작한다. `Ctrl+C`로 종료한다.

서버를 실행한 상태에서 다른 터미널로 `npm run demo`를 실행한다. 세 상품의 가입과 상품별 위험 확인을 시연한다. 고객 확인 뒤 상품마다 가입 거래 한 건을 제출한다. RPC 독립 검증과 원본 변경 탐지 결과는 `.local/demo/v4/`에 저장한다. auditor 앱의 **독립 검증**에서 `receipt.json`과 `original.json`을 열어 대조한다. `modified.json`은 불일치를 보여준다.

이어서 `npm run demo:attacks`를 실행하면 중복 가입, 다른 판매 ID나 상품의 증명 재사용, 공개 입력 바꿔치기를 시도한다. 실패 영수증은 `.local/demo/v4/attacks.json`에 저장한다.

```bash
npm run zk:setup
npm run contracts:test
npm test
npm run build
```

Foundry는 역할과 단계 통제를 검사한다. Node 통합 검사는 별도 Anvil에 Groth16 Verifier를 배포한다. 진단, 임시 기록 폐기, 필수 동의, 가입 거래 한 건을 검사한다. 범위 밖 입력 검사에서 나오는 Circom assertion 오류는 예상한 출력이다. CI도 이 검사를 실행한다.

## Sepolia로 전환

```bash
npm run sepolia:prepare
```

`.env.sepolia`에 역할별 임의 테스트 키와 접근 코드를 만든다. 파일 권한은 `600`이다. 기존 파일이 있으면 키를 유지한다. 배포용 주소와 잔액만 출력한다. 배포 주소에 약 0.03 Sepolia ETH를 충전한다. 가스 가격에 따라 필요한 양은 달라진다. 배포 스크립트는 나머지 역할 지갑 5개에 각각 0.003 테스트 ETH를 보낸다.

```bash
npm run contracts:build
npm run deploy:sepolia
npm run release:sepolia
NETWORK=sepolia npm run dev
NETWORK=sepolia npm run demo
```

로컬 서버를 먼저 종료한다. 웹에서 `.env.sepolia`의 `DEMO_TOKEN`을 입력한다. 키와 접근 코드를 채팅이나 저장소에 올리지 않는다. 배포 스크립트는 실제 테스트넷 거래를 발생시킨다. `release:sepolia`는 Vercel 빌드에 쓸 배포본을 `deploy/sepolia/`에 만든다. 현재는 로컬 시연까지만 실행했다. Vercel 배포 순서와 환경 변수는 [배포 문서](docs/deploy.md)를 따른다. [실행·발표·복구 안내](docs/runbook.md)

증명 키는 단일 운영자가 만든 시연용 trusted setup이다. 실제 운영용 MPC ceremony는 수행하지 않았다. 키를 바꾸면 Verifier와 원장을 다시 배포해야 한다. 고객 원본은 `.local/`의 권한 `600` 파일에 저장한다. 로컬 원장 상태도 `.local/`에 저장한다. 이 폴더를 삭제하면 로컬 이력과 원본을 잃는다. 기관 인증과 서명은 시연용이다. 외부 시연은 단일 접근 코드로 제한한다.

v4는 기존 Groth16 회로와 증명 키를 쓰는 새 원장이다. v1·v2·v3의 거래와 로컬 원본은 이전 원장 주소에 연결해 보존한다. 이전 원장에 연결할 수 있고 해당 배포가 검증 대상으로 등록되어 있으면 **독립 검증**의 파일 검증 경로에서 보관한 파일을 대조할 수 있다.

## 문서

사실 하나는 문서 하나에만 적는다. 다른 문서는 링크한다.

| 문서                                               | 내용                                                       |
| -------------------------------------------------- | ---------------------------------------------------------- |
| [docs/prd.md](docs/prd.md)                         | 제품 정의, 시연 범위, 완료 기준. 업무 규칙의 기준이다      |
| [docs/market-research.md](docs/market-research.md) | 경쟁 서비스와 선행 사례, 차별화 가설                       |
| [docs/deploy.md](docs/deploy.md)                   | 배포 구성, 순서, 환경 변수, 한도. 배포 정보의 기준이다     |
| [docs/runbook.md](docs/runbook.md)                 | 로컬 실행, 발표 순서, 검증 절차, 오류와 복구               |
| [docs/adr](docs/adr/)                              | 결정 기록. 맥락·결정·이유·대가를 남긴다                    |
| [DESIGN.md](DESIGN.md)                             | 화면 규칙과 디자인 토큰                                    |
| [AGENTS.md](AGENTS.md)                             | 작업 규칙. 하위 폴더의 AGENTS.md가 그 영역의 규칙을 더한다 |

## 참여자와 역할

| 참여자                     | 역할                                                  | 쓰는 화면                              | 기말 MVP                                                                            |
| -------------------------- | ----------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| 자산운용사 (B2B)           | 상품·클래스·설명서 버전 관리                          | client · 상품·문서 관리                | 가상 펀드 세 종, 상품별 온라인 Ce와 설명서 v1                                       |
| 판매 증권사 (B2B)          | 고객 확인, 진단 규칙 관리, 판매 절차, 원본 관리       | client · 판매·검토 현황, 온체인 처리   | 진단 규칙 v3과 별도 테스트 키                                                       |
| 준법 담당자 (B2B)          | 재진단 경고와 증빙 누락 확인, 추가 검토               | client · 판매·검토 현황                | 세 번째 진단 뒤 필요한 검토 승인                                                    |
| 감독기관·외부 검증자 (B2G) | 지정 원장에서 버전·증명·이력 대조                     | auditor · 독립 검증                    | 고객 파일과 RPC를 쓰는 독립 검증 화면                                               |
| 투자자                     | 상품 확인, 진단, 설명 확인, 가입 확정, 본인 기록 확인 | 증권사 앱. FINVERIC 화면은 쓰지 않는다 | client의 판매 채널 시연으로 보여준다. 가상 고객 한 명, 임시 가입 건마다 진단 1~10회 |
| 기존 펀드 업무 인프라      | 매입 요청과 자금·기준가격·좌수 결과 처리              | 없음                                   | 별도 테스트 키로 모의 매입 결과 전달                                                |

실제 기관의 참여와 운영 권한은 설계 가정이다. 감독기관의 공식 승인이나 실제 펀드넷 연동은 포함하지 않는다. 해시·ZKP는 원본 보관을 대체하지 않는다. MVP는 고객이 내려받은 가상 원본으로 변경 여부를 확인한다. 별도 보관 서비스와 장기 접근 보장은 후속 범위다.

## 개발 스택

| 영역                                              | 선택                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 개발 환경                                         | Node.js 22.12 이상 22.x, npm 10 workspaces, TypeScript 5.9. 설치 버전은 package-lock.json으로 고정했다.                                                                                                                                                                                                                    |
| 웹 · `apps/client`, `apps/auditor`, `packages/ui` | React 19, Vite 8, React Router 7. 공통 컴포넌트는 shadcn/ui와 Tailwind CSS를 쓴다. 테마는 CSS 변수로 정의하고 화면별 스타일은 CSS Modules로 관리한다. 폼 상태는 React에서 관리한다. 두 앱이 쓰는 화면 요소와 API 클라이언트는 `packages/ui`에 둔다.                                                                        |
| API · `apps/api`                                  | Fastify 5 REST와 JSON Schema. 서버에서 viem 2로 거래를 제출한다. 독립 검증 화면은 viem으로 RPC에서 직접 읽는다. 로컬은 Node 프로세스로, 외부 시연은 Vercel 함수로 실행한다. 계층은 경로 → 업무 절차 → 리포지토리·게이트웨이다. 요청·응답 DTO는 `packages/core/src/api.ts`에 둔다. [결정 기록](docs/adr/0004-api-layers.md) |
| 배포                                              | Vercel Hobby에 웹 두 개와 API 함수를 같은 도메인으로 배포한다. Build Output API v3 결과물을 `scripts/build-vercel.mjs`가 만든다. [배포 문서](docs/deploy.md)                                                                                                                                                               |
| ZKP · `circuits`                                  | Circom 2.2.3과 snarkjs 0.7.6. Groth16·BN254로 증명한다. circomlib와 circomlibjs의 Poseidon을 회로와 서버에서 같은 입력 순서로 사용한다. 브라우저의 poseidon-lite도 같은 결과인지 통합 검사한다.                                                                                                                            |
| 원장 · `contracts`                                | Solidity 0.8.30, Foundry 1.4.4. forge로 원장과 생성된 Verifier를 빌드·검사한다. viem으로 배포·조회한다. anvil로 실행한다.                                                                                                                                                                                                  |
| 저장                                              | 가상 답변과 증명 입력을 로컬에서는 Git에서 제외한 파일에, Vercel에서는 Upstash Redis에 보관한다. Redis에서는 잠금 안에서만 기록을 바꾼다. 고객은 원본 묶음과 검증 영수증을 내려받는다. 원장 상태와 일반 로그에 답변·총점·비공개 임의값·실제 개인정보를 넣지 않는다. 재시작하면 원장 영수증과 진단 상태를 대조한다.         |
| 테스트                                            | Foundry로 단계 통제를 검사한다. Node.js 테스트 러너와 Fastify inject로 실제 증명과 API를 검사한다. ego-browser로 가입과 독립 검증을 확인한다.                                                                                                                                                                              |

개발 중에는 Vite의 프록시로 `/api`를 Fastify에 연결한다. 증명은 같은 Node 프로세스에서 생성한다. 브라우저에서 답변 커밋먼트와 준비한 증명을 검사한 뒤 고객이 최종 확인한다. 서버가 보관한 테스트 고객 키로 가입 거래를 제출한다. 컨트랙트는 모든 진단의 증명과 필수 동의, 필요한 준법 서명을 검사한다. 확정한 가입 건의 원본과 거래 상태는 로컬 파일로 보관한다. 미확정 거래가 남아 있으면 영수증을 먼저 확인한다.

## 시연 환경과 순서

- **배포 시연.** Vercel의 웹 두 개·API 함수, Upstash Redis, Sepolia 컨트랙트를 연결한다. client 창과 auditor 창을 나란히 띄워 같은 판매 ID를 기관과 검증자가 각자 확인한다. 맥미니 같은 상시 서버는 필요 없다.
- **실제 처리.** ZKP 생성·검증, 원장 거래, 영수증·이벤트 조회, 원본 대조를 실제로 실행한다. 역할별 테스트 키는 서버에 둔다. 고객의 최종 확인을 테스트 고객 계정의 거래에 연결한다.
- **모의 처리.** 본인인증·전자서명·자금 이동·펀드 매입 결과를 모의 처리로 표시한다. 가입 조건 검증 완료와 모의 매입 결과 반영을 구분한다.
- **시연 순서.** 상품·규칙 등록 → 가입 중단과 임시 기록 폐기 → 새 가입의 투자성향 진단과 준법 검토 → 필요한 추가 위험 확인 → 가입 거래 한 건 → 독립 검증과 변경 탐지를 보여준다. 모의 매입은 별도로 시연한다. [시연 수치와 기대 결과](docs/prd.md#기말-시연-시나리오)
- **로컬 리허설.** 같은 코드를 Vite·Fastify·Anvil로 실행한다. 실제 배포에서는 외부 접속과 RPC·API 연결을 확인한다.

## 개발 참고

[shadcn/ui Vite 설정](https://ui.shadcn.com/docs/installation/vite) · [Foundry](https://www.getfoundry.sh/) · [snarkjs Solidity Verifier 생성](https://github.com/iden3/snarkjs#25-turn-the-verifier-into-a-smart-contract) · [Vercel Build Output API](https://vercel.com/docs/build-output-api) · [Vercel 함수 한도](https://vercel.com/docs/functions/limitations) · [Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi)
