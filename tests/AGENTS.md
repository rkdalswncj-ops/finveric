# 검사 작업 규칙

- 통합 검사는 Anvil 18545 포트와 `.local/test-*` 임시 디렉터리를 쓴다. 시연용 Anvil(8545)과 `.local/`의 기록을 바꾸지 않는다.
- 실제 회로, 증명, EVM으로 검사한다. Verifier stub은 Foundry 검사에서만 쓴다.
- 공유 저장소 검사는 `fake-upstash.ts`를 쓴다. 실제 Upstash에 연결하지 않는다.
- `npm test`는 `*.test.ts`만 실행한다. 도우미 파일에는 다른 이름을 쓴다.
