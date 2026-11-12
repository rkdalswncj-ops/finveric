# 회로 작업 규칙

- `suitability.circom`은 v5 범용 진단 회로다. 최대 크기는 문항 10개, 선택지 5개, 투자성향 5단계, 위험등급 6단계다. 진단 기준 값은 비공개 입력이고, 회로가 기준 해시를 계산해 공개 입력과 대조한다.
- 순서는 `packages/core`와 같아야 한다. 기준 필드는 `rules.ts`의 `ruleFields()`·`ruleHash()`, 커밋먼트는 `index.ts`의 `diagnosisCommitment()`, 공개 신호는 `PUBLIC_SIGNALS`와 원장 `recordDiagnosis`를 따른다.
- 회로를 바꾸면 `npm run zk:setup`으로 증명 키와 Verifier를 다시 만든다. 그 뒤 원장을 새 주소에 배포한다. 회로가 같으면 기존 키를 다시 쓴다.
- 키 위치는 `FINVERIC_ZK_DIR`이다. 기본값은 `circuits/build/`다. 개발과 검사는 임시 디렉터리를 지정해 시연 키를 덮어쓰지 않는다.
- `circuits/build/`는 Git에 넣지 않는다. 배포한 Verifier에 맞는 키는 `deploy/<network>/`에 있다. 그 키를 덮어쓰지 않는다.
- `zk:setup`은 `--O2`로 컴파일하고 제약 수에 맞춰 ptau 크기를 정한다(최소 2^14). 2026-11-12 기준 제약 8,326개, 2^14, 증명 생성 약 2초다.
- 증명 키는 단일 운영자가 만든 시연용 trusted setup이다. 운영용으로 쓰지 않는다.
- 범위 밖 답변, 등록 기준과 다른 값, 바꾼 커밋먼트로 증명을 만들 수 없는지 `npm test`로 확인한다. 이때 나오는 Circom assertion 오류는 예상한 출력이다.
