# 핀베릭(FINVERIC), 펀드 판매절차 공동 검증 플랫폼

자산운용사·판매 증권사·감독기관이 같은 펀드 판매 기록을 함께 검증하는 B2B·B2G 서비스다. 투자자는 FINVERIC 화면을 직접 쓰지 않는다. 투자자는 증권사 앱에서 가입하고, 증권사 앱이 FINVERIC API에 연결한다.

1. 판매 기록과 검증 경로가 분쟁 당사자인 판매사에 몰려 있다
   - 투자성향 진단, 설명 확인, 추가 위험 확인, 준법 검토를 가입 건 하나로 묶는다
   - 스마트컨트랙트가 증명과 필수 동의를 거래 한 건에서 검사하고 가입을 확정한다
2. 답변을 공개하지 않고 판정 결과를 증명한다
   - ZKP(Groth16)로 등록된 규칙에 따라 투자성향을 계산했음을 증명한다
   - 답변, 총점, 임의값은 원장에 올리지 않는다
3. 판매사 API 없이 기록을 검증한다
   - 감독기관·외부 검증자는 고객 파일과 공개 원장(RPC)만으로 기록을 대조한다
   - 원본을 바꾸면 불일치를 표시한다

업무 규칙과 완료 기준은 [PRD](docs/prd.md)를 따른다.

## 화면

| 앱      | 경로        | 사용자                          | 화면                                                        |
| ------- | ----------- | ------------------------------- | ----------------------------------------------------------- |
| client  | `/client/`  | 운용사·증권사·준법 담당자 (B2B) | 상품·문서 관리, 판매·검토 현황, 온체인 처리, 판매 채널 시연 |
| auditor | `/auditor/` | 감독기관·외부 검증자 (B2G)      | 독립 검증                                                   |

- 판매 채널 시연은 증권사 앱에서 고객이 보는 화면을 재현한다.
- 두 앱과 API는 같은 도메인에서 실행한다. 루트 `/`는 `/client/`로 보낸다.

## 개발 환경

- 모노레포: npm workspaces, Node.js 22, TypeScript 5.9
- 프론트엔드: React 19, Vite 8, React Router 7, shadcn/ui, Tailwind CSS
- 백엔드: Fastify 5. 경로 → 업무 절차 → 리포지토리·게이트웨이 계층 ([ADR 0004](docs/adr/0004-api-layers.md))
- API 계약: 요청·응답 DTO와 JSON Schema를 `packages/core/src/api.ts` 한 곳에 둔다
- ZKP: Circom 2.2.3, snarkjs 0.7.6, Groth16·BN254
- 원장: Solidity 0.8.30, Foundry 1.4.4, viem 2. 로컬은 Anvil, 외부 시연은 Sepolia
- 저장: 로컬은 파일, 배포는 Upstash Redis. 별도 DB 서버는 없다
- 호스팅: Vercel 프로젝트 하나에 웹 두 개와 API 함수 ([배포](docs/deploy.md))
- 로컬 실행: Docker 또는 Node

## 구조

```
apps/
  client/      기관 업무와 판매 채널 시연
  auditor/     독립 검증
  api/         Fastify API (routes · modules · repositories · gateways)
packages/
  core/        판정·해시·검증 로직, 원장 ABI, API 계약(DTO)
  ui/          두 웹 앱의 공통 화면 요소와 API 클라이언트
circuits/      ZKP 회로
contracts/     원장 컨트랙트
deploy/        Vercel 빌드에 쓰는 원장 배포본
scripts/       개발·배포·시연 스크립트
tests/         통합 검사
docs/          PRD, 배포, 실행, 결정 기록
```

## 시작하기

### Docker

```bash
docker compose up --build
```

- 한 컨테이너에서 Anvil, API, client, auditor를 실행한다.
- 첫 실행은 증명 키를 만들고 컨트랙트를 배포하므로 2~4분 걸린다. `docker compose ps`가 `healthy`이면 준비된 것이다.
- [client](http://localhost:5173/client/) · [auditor](http://localhost:5174/auditor/) · [health](http://localhost:3001/api/health)
- 멈출 때는 `docker compose down`, 기록까지 지울 때는 `docker compose down -v`를 실행한다.

### Node

Node.js 22.12 이상 22.x와 npm 10이 필요하다. Foundry와 Circom은 npm 패키지에 들어 있다.

```bash
npm ci
npm run dev
```

- [client](http://127.0.0.1:5173/client/) · [auditor](http://127.0.0.1:5174/auditor/) · [health](http://127.0.0.1:3001/api/health)
- 처음에는 client의 **상품·문서 관리**에서 상품과 진단 규칙을 등록한다. 그다음 **판매 채널 시연**에서 가입을 시작한다.
- 로컬 원장 상태와 판매 기록은 `.local/`에 저장한다. 이 폴더를 지우면 이력과 고객 원본을 잃는다.

## 명령어

| 명령                                                             | 내용                                                            |
| ---------------------------------------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                                                    | Anvil, API, client, auditor를 실행한다                          |
| `npm test`                                                       | 실제 회로·EVM·API 통합 검사와 저장소·잠금 검사                  |
| `npm run contracts:test`                                         | 원장의 단계·권한 검사 (Foundry)                                 |
| `npm run build`                                                  | 타입 검사와 웹 빌드                                             |
| `npm run demo`                                                   | 세 상품의 가입을 자동 시연한다. 결과는 `.local/demo/v4/`에 둔다 |
| `npm run demo:attacks`                                           | 중복 가입, 증명 재사용, 공개 입력 변경이 거절되는지 시연한다    |
| `npm run sepolia:prepare` → `deploy:sepolia` → `release:sepolia` | Sepolia 원장 배포 ([배포](docs/deploy.md))                      |
| `npm run build:vercel`                                           | Vercel 결과물(`.vercel/output`)을 만든다                        |

## 실제 처리와 모의 처리

- 실제: ZKP 생성·검증, 원장 거래, 영수증·이벤트 조회, 원본 대조
- 모의: 본인인증, 전자서명, 자금 이동, 펀드 매입 결과
- 증명 키는 단일 운영자가 만든 시연용 trusted setup이다. 운영에 쓰지 않는다
- 감독기관의 공식 참여와 실제 펀드넷 연동은 설계 가정이다

## 문서

| 문서                                 | 내용                                                    |
| ------------------------------------ | ------------------------------------------------------- |
| [PRD](docs/prd.md)                   | 제품 정의, 참여자, 시연 범위, 시연 시나리오, 완료 기준  |
| [시장 조사](docs/market-research.md) | 경쟁 서비스와 선행 사례, 차별화 가설                    |
| [배포](docs/deploy.md)               | Vercel·Upstash·Sepolia 배포 순서, 환경 변수, 한도       |
| [실행과 시연](docs/runbook.md)       | 발표 순서, 검증 절차, 오류와 복구                       |
| [결정 기록](docs/adr/)               | 앱 분리, Vercel·Upstash, Sepolia, API 계층을 정한 이유  |
| [DESIGN.md](DESIGN.md)               | 화면 규칙과 디자인 토큰                                 |
| [AGENTS.md](AGENTS.md)               | 작업 규칙. 하위 폴더의 AGENTS.md가 영역별 규칙을 더한다 |
