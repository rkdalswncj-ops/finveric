# 회로 작업 규칙

- 회로를 바꾸면 `npm run zk:setup`으로 증명 키와 Verifier를 다시 만든다. 그 뒤 원장을 새 주소에 배포한다.
- `circuits/build/`는 Git에 넣지 않는다. 배포한 Verifier에 맞는 키는 `deploy/<network>/`에 있다. 그 키를 덮어쓰지 않는다.
- 증명 키는 단일 운영자가 만든 시연용 trusted setup이다. 운영용으로 쓰지 않는다.
- Poseidon 입력 순서는 회로, `packages/core`, API, 브라우저가 같아야 한다.
- 범위 밖 입력으로 유효한 증명을 만들 수 없는지 `npm test`로 확인한다. 이때 나오는 Circom assertion 오류는 예상한 출력이다.
