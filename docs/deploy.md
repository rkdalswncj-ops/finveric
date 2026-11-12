# 배포

2026-11-12 · 배포 정보의 기준 문서다. 다른 문서는 이 문서를 링크한다.

## 구성

| 대상 | 위치 | 설명 |
| --- | --- | --- |
| 웹 | Vercel `/`, `/client/`, `/auditor/` | 진입 화면, 판매사 콘솔과 판매 채널 시연, 감독기관 화면. Vite 앱 하나의 페이지 세 개다 |
| API | Vercel 함수 `/api` | Fastify 앱 하나를 함수 하나로 실행한다 |
| 판매 기록 | Upstash Redis | 여러 함수 인스턴스가 같은 기록과 잠금을 쓴다 |
| 원장 | Sepolia | 컨트랙트 2개. 누구나 같은 원장을 조회한다 |

웹과 API를 같은 도메인에 둔다. 그래서 CORS 설정과 API 주소 환경 변수가 필요 없다. 맥미니나 다른 상시 서버는 필요 없다. 결정 이유는 [ADR 0002](adr/0002-vercel-functions-and-upstash.md)와 [ADR 0003](adr/0003-sepolia-ledger.md)에 있다.

로컬 개발은 그대로다. `npm run dev`는 Anvil, API, 웹(5173)을 실행한다. 로컬 API는 판매 기록을 `.local/`의 파일에 쓴다.

## 현재 상태

- 코드는 Vercel 배포를 지원한다. 로컬에서 `NETWORK=local npm run build:vercel`로 결과물을 만들었다. 번들 함수로 실제 증명 생성까지 확인했다.
- Sepolia 원장은 아직 배포하지 않았다. 배포 지갑에 테스트 ETH를 충전해야 한다.
- Vercel 프로젝트와 Upstash Redis는 아직 연결하지 않았다.

## 배포 순서

### 1. Sepolia 원장

```bash
npm run sepolia:prepare
```

`.env.sepolia`가 있으면 기존 키를 유지한다. 출력된 배포 주소에 faucet에서 약 0.03 Sepolia ETH를 받는다. 배포 스크립트가 잔액 0.025 ETH 이상을 확인한다. 배포 뒤 역할 지갑 5개에 0.003 ETH씩 보낸다.

```bash
npm run contracts:build
npm run deploy:sepolia
npm run release:sepolia
```

`release:sepolia`는 `deploy/sepolia/`에 배포본을 만든다. 배포본은 공개 배포 설정, 증명 키(zkey), 회로 WASM이다. 증명 키 지문이 배포한 Verifier와 다르면 만들지 않는다. `deploy/sepolia/`를 커밋한다. Vercel은 Git 저장소에서 빌드하는데 `.local/`과 `circuits/build/`는 Git에 없기 때문이다. 증명 키는 증명 생성에 쓰는 공개 파일이다. 개인키와 고객 원본은 넣지 않는다.

### 2. Vercel 프로젝트

1. Vercel Hobby 계정에서 GitHub 저장소 `yhc125/finveric`을 가져온다.
2. 빌드 설정은 `vercel.json`이 정한다. 설치 `npm ci`, 빌드 `npm run build:vercel`, 프레임워크 없음.
3. Node.js 버전은 22.x를 쓴다. `package.json`의 `engines`와 같다.

`build:vercel`은 웹 두 개를 빌드한다. 이어서 `.vercel/output`을 [Build Output API v3](https://vercel.com/docs/build-output-api) 형식으로 만든다. API는 esbuild로 한 파일에 묶는다. 증명 키, WASM, 배포 설정을 함수 디렉터리에 함께 넣는다. 배포본이 없거나 증명 키가 다르면 빌드를 멈춘다.

### 3. Upstash Redis

Vercel Marketplace에서 Upstash Redis를 프로젝트에 연결한다. API는 아래 이름 중 하나를 읽는다.

- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`

Vercel에서 이 값이 없으면 API가 시작을 거절한다. 함수의 파일은 다음 호출까지 남는다는 보장이 없기 때문이다.

### 4. 환경 변수

Production과 Preview에 같은 값을 넣는다.

| 이름 | 값 |
| --- | --- |
| `NETWORK` | `sepolia` |
| `RPC_URL` | Sepolia RPC 주소. 없으면 `https://ethereum-sepolia-rpc.publicnode.com`을 쓴다 |
| `DEMO_TOKEN` | 32자 이상. `.env.sepolia`의 값 |
| `DEPLOYER_PRIVATE_KEY` 외 역할 키 5개 | `.env.sepolia`의 값. `MANAGER`, `SELLER`, `COMPLIANCE`, `CUSTOMER`, `INFRASTRUCTURE` |

개인키는 직접 입력한다. 채팅이나 저장소에 올리지 않는다. Vercel CLI를 쓰면 값을 화면에 출력하지 않고 넣을 수 있다.

```bash
for role in DEPLOYER MANAGER SELLER COMPLIANCE CUSTOMER INFRASTRUCTURE DEMO; do
  key=$([ "$role" = DEMO ] && echo DEMO_TOKEN || echo "${role}_PRIVATE_KEY")
  for target in production preview; do
    grep "^${key}=" .env.sepolia | cut -d= -f2- | vercel env add "$key" "$target"
  done
done
```

`NETWORK=sepolia`도 같은 방법으로 넣는다. `WEB_ORIGIN`은 웹을 다른 도메인에 둘 때만 쓴다. 쉼표로 여러 출처를 지정한다.

### 5. 배포 뒤 확인

1. `/api/health`가 200, `ok: true`, 체인 ID 11155111을 돌려준다. `checks`의 `rpc`, `ledger`, `store`가 모두 `ok: true`여야 한다. 하나라도 실패하면 503과 실패 이유를 돌려준다.
2. 판매사 콘솔(`/client/`)에서 접근 코드를 입력한다. 상품 관리에서 상품과 진단 기준을 등록한다.
3. 판매 채널 시연에서 가입 한 건을 끝까지 진행한다.
4. 감독기관 화면(`/auditor/`)에서 같은 판매 ID를 두 경로로 검증한다. 판매 채널 시연의 가입 기록 확인에서도 `일치`를 확인한다.

## 동작 방식

- **저장.** 판매 기록은 Redis의 JSON 문서 하나다. 키는 `finveric:<체인 ID>:<원장 주소>`로 시작한다.
- **잠금.** 기록을 바꾸는 요청은 Redis 잠금을 잡는다. 최신 기록을 읽은 뒤 실행한다. 잠금은 310초 뒤 만료된다. 함수 최대 실행 시간 300초보다 길다. 다른 요청이 잠금을 잡고 있으면 최대 120초 기다린다.
- **저장 조건.** 잠금 소유자만 기록을 쓴다. 잠금이 만료된 뒤에는 쓰기를 거절한다.
- **조회.** 조회 요청은 잠금 없이 최신 기록을 읽는다. 조회 중 영수증 대조 결과는 저장하지 않는다.
- **시작 검사.** 인스턴스마다 처음 한 번 원장 버전, 증명 키 지문, 체인 ID, 원장 코드를 검사한다. 중단된 기록 복구는 잠금 안에서만 한다.

## 한도

| 항목 | 한도 | 출처 |
| --- | --- | --- |
| Vercel 함수 실행 시간 | 최대 300초 | [Vercel 함수 한도](https://vercel.com/docs/functions/limitations) |
| Vercel 함수 메모리·CPU | 2 GB / 1 vCPU | 같은 문서 |
| Vercel 월 Active CPU | 4시간 | [Hobby 플랜](https://vercel.com/docs/plans/hobby) |
| Vercel 사용 조건 | 비상업적 개인 사용만 허용 | [공정 사용 지침](https://vercel.com/docs/limits/fair-use-guidelines) |
| Upstash 무료 | 월 50만 명령, 데이터 250 MB, 요청 10 MB | [Upstash 요금](https://upstash.com/pricing/redis) |

Sepolia 블록은 약 12초마다 생긴다. 가입 확정 요청은 영수증을 기다리므로 수십 초 걸릴 수 있다.

## 아직 확인하지 않은 것

- Git으로 시작한 Vercel 빌드가 `.vercel/output`을 그대로 쓰는지. 프레임워크 어댑터가 쓰는 방식이지만 첫 배포에서 확인한다.
- Vercel이 함수에 넘기는 요청 주소의 형태. 두 형태(`/api/sales`, `/api?__path=sales`)를 모두 처리한다.
- Marketplace 연결이 넣는 Upstash 환경 변수 이름.
- 1 vCPU에서 증명 생성 시간. 로컬 M 시리즈에서는 약 0.6초였다.
