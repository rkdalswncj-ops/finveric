# API 작업 규칙

진입점은 두 개다. 로컬은 `src/index.ts`, Vercel 함수는 `src/vercel.ts`다. 두 곳 모두 `initialize()`를 먼저 호출한다.

## 구조

| 파일 | 내용 |
| --- | --- |
| `src/app.ts` | Fastify 조립: 접근 코드, 출처 검사, CORS, 요청 한도, 오류 응답, 경로 |
| `src/service.ts` | `FundService`: 배포 설정, 판매 기록, 저장, 잠금, 시작 검사. 업무 메서드는 모듈로 넘긴다 |
| `src/store.ts` | 판매 기록 저장소(`FileStore`, `RedisStore`) |
| `src/modules/products.ts` | 운용사·판매사: 상품·설명서 버전과 진단 규칙 등록 |
| `src/modules/enrollment.ts` | 판매 채널: 가입 신청, 진단, 최종 확인과 가입 거래, 중단 |
| `src/modules/review.ts` | 준법 담당자: 세 번째 진단부터 검토 서명 |
| `src/modules/purchase.ts` | 기존 펀드 업무 인프라: 모의 매입 |
| `src/modules/records.ts` | 공개 조회, 처리 기록, 고객 증빙(영수증·원본) |
| `src/modules/ledger.ts` | 원장 거래 제출, 영수증 대조, 판매 건 조회 |
| `src/modules/proofs.ts` | Groth16 증명 생성과 원장 호출 형식 변환 |

- 모듈 함수는 첫 인자로 `FundService`를 받는다. 모듈은 `service.ts`를 타입으로만 import한다. 실행 시 순환 import를 만들지 않는다.
- 새 업무는 맞는 모듈에 넣는다. `FundService`에는 외부(경로, 테스트, 스크립트)가 부르는 메서드만 둔다.

## 기록과 잠금

- 기록을 바꾸는 요청은 `service.exclusive()` 안에서 실행한다. 로컬은 프로세스 안의 큐로, Vercel은 Redis 잠금으로 한 번에 하나만 실행한다.
- 조회 요청은 `service.view()`로 감싼다. Vercel에서는 다른 인스턴스가 쓴 기록을 먼저 읽는다.
- 공유 저장소에서 `save()`는 잠금 안에서만 기록을 쓴다. 잠금 밖의 변경은 메모리에만 남는다. 조회 경로에서 반드시 저장해야 하는 상태를 만들지 않는다.
- 저장소 구현은 `src/store.ts`다. 로컬은 `FileStore`, Vercel은 `RedisStore`다. Vercel에서 Redis 설정이 없으면 시작을 거절한다.

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
