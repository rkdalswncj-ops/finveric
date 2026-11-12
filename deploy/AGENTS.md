# 배포본 규칙

- `deploy/<network>/`의 파일은 `npm run release:<network>`로만 만든다. 손으로 고치지 않는다.
- 배포본은 공개 배포 설정(`deployment.json`), 증명 키(`suitability.zkey`), 회로 WASM(`suitability.wasm`)이다. 개인키와 고객 원본은 넣지 않는다.
- Vercel 빌드는 이 파일을 API 함수에 넣는다. 증명 키 지문이 배포 설정과 다르면 빌드가 멈춘다.
- 원장을 다시 배포하면 배포본도 다시 만들고 커밋한다.
- 절차: [docs/deploy.md](../docs/deploy.md)
