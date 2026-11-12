# 원장 작업 규칙

- `FundLedger.sol`은 원장 v5다(`ledgerVersion()` = 5). 기준·상품 버전 등록, 진단 회차, 청약, 숙려 뒤 최종 확인, 철회, 모의 결제를 기록한다. 기록을 고치거나 지우는 함수를 두지 않는다.
- 역할은 넷이다. 판매사(등록·진단), 승인자(3회차 이상 청약의 EIP-191 서명), 고객(청약·최종 확인·철회), 인프라(모의 결제). 배포자는 원장 역할이 아니다.
- 회차는 고객 가명 ID마다 원장이 정한다. `recordDiagnosis`는 회차 검사(`InvalidAttempt`)를 가장 먼저 한다. 사후 변경 시연이 이 오류를 보여 준다.
- 숙려 최소 경과 시간은 생성자 값이다. 로컬과 Sepolia 시연은 60초다.
- `src/Groth16Verifier.sol`은 `npm run zk:setup`이 만든다. 직접 고치거나 커밋하지 않는다.
- 원장을 바꾸면 `ledgerVersion`, 배포 스크립트, API 시작 검사, `packages/core/src/abi.ts`를 함께 맞춘다. `tests/core.test.ts`가 core ABI와 컴파일 결과를 대조한다.
- 이미 배포한 원장의 기록은 그 주소로 보존한다. 새 버전은 새 주소에 배포한다.
- 답변·총점·임의값·개인정보를 상태나 이벤트에 넣지 않는다.
- 검사: `npm run contracts:test`(단계·권한·숙려, Verifier stub). 실제 Verifier 경로는 `npm test`가 검사한다.
