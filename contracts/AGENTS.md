# 원장 작업 규칙

- `src/Groth16Verifier.sol`은 `npm run zk:setup`이 만든다. 직접 고치거나 커밋하지 않는다.
- 원장을 바꾸면 `ledgerVersion`, 배포 스크립트, API 시작 검사, `packages/core`의 ABI를 함께 맞춘다.
- 이미 배포한 원장의 기록은 그 주소로 보존한다. 새 버전은 새 주소에 배포한다.
- 답변·총점·임의값·개인정보를 상태나 이벤트에 넣지 않는다.
- 검사: `npm run contracts:test`(단계·권한, Verifier stub). 실제 Verifier 경로는 `npm test`가 검사한다.
