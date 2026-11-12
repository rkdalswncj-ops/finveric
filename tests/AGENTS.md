# 검사 작업 규칙

- 통합 검사는 빈 포트에 띄운 Anvil과 `.local/test-*` 임시 디렉터리를 쓴다. 시연용 Anvil(8545)과 `.local/`의 기록을 바꾸지 않는다.
- 증명 키는 `FINVERIC_ZK_DIR`(기본 `circuits/build`)에서 읽는다. 시연 키와 다른 키로 검사하려면 같은 변수로 `npm run zk:setup`을 먼저 실행한다.
- 실제 회로, 증명, EVM으로 검사한다. Verifier stub은 Foundry 검사에서만 쓴다.
- `mvp.test.ts`: 등록, 회차, 승인, 청약, 숙려, 독립 검증, 위험 신호, 저장소, 복구. 원장 가스 사용량을 `# gas` 진단 출력으로 남긴다.
- `core.test.ts`: 기준 검사·해시·판정, 상품, 고객 가명 ID, 위험 신호, core ABI 대조. ABI 대조는 `out/`의 Foundry 산출물이 있어야 실행한다.
- 공유 저장소 검사는 `fake-upstash.ts`를 쓴다. 실제 Upstash에 연결하지 않는다.
- `npm test`는 `*.test.ts`만 실행한다. 도우미 파일에는 다른 이름을 쓴다.
