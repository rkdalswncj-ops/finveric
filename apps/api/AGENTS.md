# API 작업 규칙

진입점은 두 개다. 로컬은 `src/index.ts`, Vercel 함수는 `src/vercel.ts`다. 두 곳 모두 `initialize()`를 먼저 호출한다.

## 계층

요청은 위에서 아래로만 흐른다. 아래 계층은 위 계층을 import하지 않는다. [결정 기록](../../docs/adr/0004-api-layers.md)

```
routes/        경로(컨트롤러): 요청 검사, FundService 호출
  ↓
service.ts     실행 맥락(배포 설정·역할 키·RPC·리포지토리), 시작 검사, 업무 입구
  ↓
modules/       업무 절차(서비스): 담당자별 절차
  ↓
repositories/  판매 기록 조회·추가·삭제·저장과 잠금     gateways/  원장(EVM)·증명(snarkjs) 연동
```

| 위치                          | 내용                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/app.ts`                  | Fastify 조립: 접근 코드와 API 키 확인, 공개 경로(`PUBLIC_PATHS`), 출처 검사, CORS, 키별 요청 한도, 오류 응답, API 문서, 경로 등록 |
| `src/routes/`                 | `system`(상태·설정·API 문서), `registry`(기준·상품), `customers`(진단·변경 시연), `sales`, `records`, `keys`(API 키)              |
| `src/docs/openapi.ts`         | `@fastify/swagger` 설정. 등록한 경로로 OpenAPI 3.1 문서를 만들고 인증·오류·응답을 더한다                                          |
| `src/docs/operations.ts`      | 경로별 operationId, 분류(태그), 요약, 설명, 성공 응답, 요청 예시                                                                  |
| `src/docs/page.ts`            | `/api/docs` 화면. HTML·CSS·JS를 한 문자열로 둔다                                                                                  |
| `src/service.ts`              | `FundService`: 실행 맥락, 시작 검사. 업무 메서드는 모듈로 넘긴다                                                                  |
| `src/modules/rules.ts`        | 소비자보호 담당: 진단 기준 버전 등록과 조회, 최신 기준                                                                            |
| `src/modules/products.ts`     | 소비자보호 담당: 상품 설명서 버전 등록과 조회, 시연 기준·상품 일괄 등록                                                           |
| `src/modules/customers.ts`    | 판매 채널: 고객 가명 ID, 진단 회차(증명 생성 → 판매사 키로 기록)                                                                  |
| `src/modules/enrollment.ts`   | 판매 채널: 신청(초안), 중단, 청약, 숙려 뒤 최종 확인, 철회                                                                        |
| `src/modules/review.ts`       | 관리자 승인: 3회차 이상 진단한 고객의 청약 전 승인자 서명                                                                         |
| `src/modules/settlement.ts`   | 기존 업무 인프라: 모의 결제 기록                                                                                                  |
| `src/modules/records.ts`      | 판매 건 조회, 처리 기록, 고객 증빙(증명서·원본 묶음)                                                                              |
| `src/modules/demo.ts`         | 시연: 기록한 회차의 사후 변경 시도(시뮬레이션만)                                                                                  |
| `src/modules/keys.ts`         | 판매사 콘솔: API 키 발급·폐기, 키 확인, 마지막 사용 시각(1분 단위)                                                                |
| `src/modules/health.ts`       | 운영: RPC·원장·저장소 점검(`/api/health`, 실패 시 503)                                                                            |
| `src/modules/transactions.ts` | 원장 거래 처리: 시뮬레이션 → 제출 → 영수증 대조와 처리 기록                                                                       |
| `src/repositories/sales.ts`   | `SaleRepository`: 판매 건·진단 원본·등록 원문·처리 기록, 저장, 잠금(`transaction`, `read`)                                        |
| `src/repositories/store.ts`   | 저장 방식: 로컬 `FileStore`, Vercel `RedisStore`                                                                                  |
| `src/gateways/ledger.ts`      | 원장 읽기·시뮬레이션·쓰기·승인 서명·영수증. 판매 기록은 바꾸지 않는다                                                             |
| `src/gateways/proofs.ts`      | Groth16 증명 생성. 증명 키는 `FINVERIC_ZK_DIR`(기본 `circuits/build`)                                                             |

- 경로 파일은 Fastify 플러그인(`FastifyPluginAsync<{ service }>`)이다. `app.ts`가 `/api` 접두어로 등록한다. 경로 파일 안의 주소에는 `/api`를 쓰지 않는다. 접근 코드 검사, 직렬화, 오류 처리는 `app.ts`가 플러그인보다 먼저 등록하고, 플러그인이 물려받는다.
- 경로는 `FundService`만 부른다. 모듈·리포지토리·게이트웨이를 직접 부르지 않는다.
- 모듈은 판매 기록을 `svc.repository`로만 바꾼다. 원장과 증명은 `gateways/`로만 부른다. `svc.client`를 직접 쓰지 않는다.
- 게이트웨이와 리포지토리는 서로를, 그리고 모듈을 import하지 않는다.
- 요청 스키마와 요청·응답 타입은 `packages/core/src/api.ts`의 DTO를 쓴다. 경로에서 스키마를 새로 쓰지 않는다. 모듈 함수의 반환 타입도 DTO(`SaleView` 등)로 적는다.
- 모듈 함수는 첫 인자로 `FundService`를 받는다. 하위 계층은 `service.ts`를 타입으로만 import한다. 실행 시 순환 import를 만들지 않는다.
- 새 업무는 맞는 모듈에 넣는다. `FundService`에는 외부(경로, 테스트, 스크립트)가 부르는 메서드만 둔다.

## API 문서

- `GET /api/openapi.json`은 OpenAPI 3.1 문서다. `GET /api/docs`는 그 문서를 읽어 그리는 화면이다. 두 경로와 `/api/health`, `/api/config`는 접근 코드 없이 열린다(`PUBLIC_PATHS`).
- 경로·경로 값·요청 본문은 Fastify에 등록한 경로의 스키마에서 만든다. `@fastify/swagger`는 경로보다 먼저 등록한다.
- 경로를 추가하면 `src/docs/operations.ts`에 같은 키(`<METHOD> <Fastify 경로>`, 예: `POST /api/sales`)로 operationId, 태그, 요약, 설명, 성공 응답을 추가한다. 본문이 있으면 요청 예시도 넣는다. 빠지면 문서 생성과 `tests/openapi.test.ts`가 실패한다.
- 태그는 하는 일로 정한다. 증권사 앱이 고객 한 명을 처리할 때 부르면 `판매 채널 연동`, 판매사 직원이 콘솔에서 쓰면 `판매사 콘솔`, 상태 확인과 문서는 `시스템`이다.
- 판매 건 동작은 동작마다 경로가 따로 있다(`/api/sales/:id/action/<동작>`). 동작마다 태그가 다르기 때문이다.
- 응답 스키마는 문서 전용이다. 경로의 `schema.response`에 넣지 않는다. 넣으면 응답 직렬화가 바뀌고, 문서 생성이 실패한다. 응답 스키마는 `packages/core/src/api.ts`에 두고 `operations.ts`에서 가리킨다.
- 공통 오류(400·401·403·409·429)와 인증 표시는 `src/docs/openapi.ts`가 더한다. 오류 응답을 바꾸면 이 파일의 설명도 고친다.
- 문서 화면은 외부 파일과 CDN을 쓰지 않는다. Vercel 함수 번들에 문자열로 들어간다. 색은 DESIGN.md 토큰을 그대로 쓴다.

## 원장 거래

- 원장 쓰기는 `transactions.send()`만 쓴다. 먼저 역할 계정으로 시뮬레이션한다. 원장이 거절하면 거래를 보내지 않고, 원장 오류 이름(예: `TooEarly`)을 처리 기록에 남긴다.
- 미확정 거래가 있으면 새 거래를 거절한다. 진단 회차 번호는 원장의 `attemptCount + 1`이다.
- 진단 원본(답변·임의값)과 등록 원문은 거래를 보내기 전에 저장한다. 원장이 거절하거나 거래가 실패하면 지운다. 영수증을 기다리는 중이면 남긴다.
- 청약 뒤 판매 건 상태는 원장에서 읽는다. 저장소에는 원장 밖의 값(초안, 승인 서명, 모의 녹취록, 진단 원본)만 둔다.
- 기준과 상품 버전 번호는 API가 원장의 다음 버전으로 정한다. 원장에는 정렬한 JSON 원문을 등록한다.

## 기록과 잠금

- 기록을 바꾸는 요청은 `service.exclusive()` 안에서 실행한다. 로컬은 프로세스 안의 큐로, Vercel은 Redis 잠금으로 한 번에 하나만 실행한다.
- 조회 요청은 `service.view()`로 감싼다. Vercel에서는 다른 인스턴스가 쓴 기록을 먼저 읽는다.
- 공유 저장소에서 `save()`는 잠금 안에서만 기록을 쓴다. 잠금 밖의 변경은 메모리에만 남는다. 조회 경로에서 반드시 저장해야 하는 상태를 만들지 않는다.
- 저장 방식은 `src/repositories/store.ts`다. 로컬은 `FileStore`, Vercel은 `RedisStore`다. Vercel에서 Redis 설정이 없으면 시작을 거절한다. 저장 방식을 바꿔도 모듈은 고치지 않는다.

## 인증과 API 키

[결정 기록](../../docs/adr/0008-api-keys.md)

- 접근 코드(`DEMO_TOKEN`)는 판매사 콘솔과 증권사 앱 예시가 쓴다. 서버에 설정했을 때만 검사하고, 모든 경로를 연다.
- API 키(`fvk_` + 32자)는 증권사 앱 서버가 쓴다. 보내면 접근 코드 설정과 관계없이 항상 확인한다. 없는 키와 폐기한 키는 401이다.
- API 키의 범위는 `src/docs/operations.ts`의 분류다. `판매 채널 연동`(`CHANNEL_TAG`) 경로만 부른다. 다른 경로는 403이다. 경로의 분류를 바꾸면 키로 부를 수 있는지도 바뀐다.
- 키 원문은 발급 응답에만 넣는다. 저장소에는 SHA-256 해시와 앞 12자만 둔다. 로그와 처리 기록에 키 원문을 넣지 않는다.
- 키 확인은 `service.authenticateApiKey()`다. 저장소를 먼저 읽어 다른 인스턴스의 발급·폐기를 반영한다. 마지막 사용 시각은 1분이 지났을 때만 잠금 안에서 쓴다.
- 요청 한도는 아는 키면 키마다, 아니면 IP마다 센다(`keyGenerator`). 메모리의 키만 보므로 저장소를 읽지 않는다.

## 오류와 비밀 값

- 응답 오류는 우리가 쓴 한국어 문장만 내보낸다. RPC와 Redis 오류에는 주소와 토큰이 들어갈 수 있다. 오류 처리기는 한글로 시작하고 `http`가 없는 문장만 그대로 내보낸다. `API 키는…`처럼 영문으로 시작하는 문장은 일반 오류 문장으로 바뀐다.
- 업무 오류는 409다. Fastify와 플러그인이 정한 4xx(잘못된 JSON 400, 본문 초과 413, 본문 형식 415, 요청 한도 429)는 상태 코드를 유지한다. 없는 경로는 404다.
- 공개 조회와 로그에 답변·총점·임의값·고객 번호·개인키·승인 서명을 넣지 않는다. 고객은 가명 ID로만 표시한다.
- 고객 가명 ID 비밀값은 `CUSTOMER_REF_SECRET`이다. 없으면 판매사 키에서 만든다. 비밀값을 바꾸면 같은 고객의 회차가 이어지지 않는다.

## 파일과 배포

- 실행 중 읽는 파일의 경로는 `scripts/root.ts`의 `fromRoot()`로 만든다. 증명 키는 `zkPath()`로 만든다. Vercel 함수는 함수 디렉터리를 기준으로 읽는다.
- 새로 읽는 파일이 생기면 `scripts/build-vercel.mjs`에서 함수 디렉터리에 복사한다.
- 증명 키를 바꾸면 Verifier와 원장을 다시 배포한다. 키 지문이 배포 설정과 다르면 API가 시작을 거절한다.
- 한 요청은 Vercel 함수 최대 실행 시간 300초 안에 끝나야 한다. Sepolia 영수증 대기도 포함한다.

## 검사

- `tests/mvp.test.ts`: 실제 회로·EVM·API·독립 검증, 위험 신호, 공유 저장소 인스턴스, 재시작 복구.
- `tests/store.test.ts`: 잠금, 만료, 오류 노출, 출처, Vercel 주소 변환.
- `tests/openapi.test.ts`: 문서가 등록한 모든 경로를 operationId·태그로 설명하는지, 공개 경로, 문서 화면, 4xx 상태 코드.
- `tests/keys.test.ts`: API 키 발급·저장(해시만), 범위(403), 폐기(401), 개수 제한, 키별 요청 한도. 모든 응답을 문서의 응답 스키마와 대조한다.
- `tests/mvp.test.ts`는 모든 API 응답을 `/api/openapi.json`의 응답 스키마와 대조한다(`tests/openapi-check.ts`). 문서에 없는 필드도 실패다.
- 함수 번들: `NETWORK=local npm run build:vercel` 뒤 임시 디렉터리에서 로컬 Anvil로 번들 핸들러를 호출해 확인한다.
