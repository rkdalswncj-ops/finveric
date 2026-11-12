# API 작업 규칙

진입점은 두 개다. 로컬은 `src/index.ts`, Vercel 함수는 `src/vercel.ts`다. 두 곳 모두 `initialize()`를 먼저 호출한다.

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
