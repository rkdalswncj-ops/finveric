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

| 위치                          | 내용                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `src/app.ts`                  | Fastify 조립: 접근 코드, 출처 검사, CORS, 요청 한도, 오류 응답, 경로 등록            |
| `src/routes/`                 | `system`(상태·설정), `products`(등록), `sales`(가입 절차), `records`(처리 기록·증빙) |
| `src/service.ts`              | `FundService`: 실행 맥락, 시작 검사. 업무 메서드는 모듈로 넘긴다                     |
| `src/modules/products.ts`     | 운용사·판매사: 상품·설명서 버전과 진단 규칙 등록                                     |
| `src/modules/enrollment.ts`   | 판매 채널: 가입 신청, 진단, 최종 확인과 가입 거래, 중단                              |
| `src/modules/review.ts`       | 준법 담당자: 세 번째 진단부터 검토 서명                                              |
| `src/modules/purchase.ts`     | 기존 펀드 업무 인프라: 모의 매입                                                     |
| `src/modules/records.ts`      | 공개 조회, 처리 기록, 고객 증빙(영수증·원본)                                         |
| `src/modules/health.ts`       | 운영: RPC·원장·저장소 점검(`/api/health`, 실패 시 503)                               |
| `src/modules/transactions.ts` | 원장 거래 처리 기록: 제출 기록, 영수증 대조                                          |
| `src/repositories/sales.ts`   | `SaleRepository`: 판매 건·처리 기록, 저장, 잠금(`transaction`, `read`)               |
| `src/repositories/store.ts`   | 저장 방식: 로컬 `FileStore`, Vercel `RedisStore`                                     |
| `src/gateways/ledger.ts`      | 원장 읽기·쓰기·서명·영수증. 판매 기록은 바꾸지 않는다                                |
| `src/gateways/proofs.ts`      | Groth16 증명 생성과 원장 호출 형식 변환                                              |

- 경로는 `FundService`만 부른다. 모듈·리포지토리·게이트웨이를 직접 부르지 않는다.
- 모듈은 판매 기록을 `svc.repository`로만 바꾼다. 원장과 증명은 `gateways/`로만 부른다. `svc.client`를 직접 쓰지 않는다.
- 게이트웨이와 리포지토리는 서로를, 그리고 모듈을 import하지 않는다.
- 요청 스키마와 요청·응답 타입은 `packages/core/src/api.ts`의 DTO를 쓴다. 경로에서 스키마를 새로 쓰지 않는다. 모듈 함수의 반환 타입도 DTO(`SaleView` 등)로 적는다.
- 모듈 함수는 첫 인자로 `FundService`를 받는다. 하위 계층은 `service.ts`를 타입으로만 import한다. 실행 시 순환 import를 만들지 않는다.
- 새 업무는 맞는 모듈에 넣는다. `FundService`에는 외부(경로, 테스트, 스크립트)가 부르는 메서드만 둔다.

## 기록과 잠금

- 기록을 바꾸는 요청은 `service.exclusive()` 안에서 실행한다. 로컬은 프로세스 안의 큐로, Vercel은 Redis 잠금으로 한 번에 하나만 실행한다.
- 조회 요청은 `service.view()`로 감싼다. Vercel에서는 다른 인스턴스가 쓴 기록을 먼저 읽는다.
- 공유 저장소에서 `save()`는 잠금 안에서만 기록을 쓴다. 잠금 밖의 변경은 메모리에만 남는다. 조회 경로에서 반드시 저장해야 하는 상태를 만들지 않는다.
- 저장 방식은 `src/repositories/store.ts`다. 로컬은 `FileStore`, Vercel은 `RedisStore`다. Vercel에서 Redis 설정이 없으면 시작을 거절한다. 저장 방식을 바꿔도 모듈은 고치지 않는다.

## 오류와 비밀 값

- 응답 오류는 우리가 쓴 한국어 문장만 내보낸다. RPC와 Redis 오류에는 주소와 토큰이 들어갈 수 있다.
- 공개 조회와 로그에 답변·총점·임의값·개인키를 넣지 않는다.

## 파일과 배포

- 실행 중 읽는 파일의 경로는 `scripts/root.ts`의 `fromRoot()`로 만든다. Vercel 함수는 함수 디렉터리를 기준으로 읽는다.
- 새로 읽는 파일이 생기면 `scripts/build-vercel.mjs`에서 함수 디렉터리에 복사한다.
- 증명 키를 바꾸면 Verifier와 원장을 다시 배포한다. 키 지문이 배포 설정과 다르면 API가 시작을 거절한다.
- 한 요청은 Vercel 함수 최대 실행 시간 300초 안에 끝나야 한다. Sepolia 영수증 대기도 포함한다.

## 검사

- `tests/mvp.test.ts`: 실제 회로·EVM·API·독립 검증과 공유 저장소 인스턴스.
- `tests/store.test.ts`: 잠금, 만료, 오류 노출, 출처, Vercel 주소 변환.
- 함수 번들: `NETWORK=local npm run build:vercel` 뒤 임시 디렉터리에서 로컬 Anvil로 번들 핸들러를 호출해 확인한다.
