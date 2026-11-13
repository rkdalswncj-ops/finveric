# web 앱 작업 규칙

웹은 Vite 앱 하나에 페이지 네 개다. 화면을 고치기 전에 루트 [DESIGN.md](../../DESIGN.md)를 읽는다. [결정 기록](../../docs/adr/0006-seller-console-and-single-web-app.md)

| 경로        | HTML                 | 코드           | 사용자                                        |
| ----------- | -------------------- | -------------- | --------------------------------------------- |
| `/`         | `index.html`         | `src/entry/`   | 모두. 역할 선택과 원장 상태                   |
| `/client/`  | `client/index.html`  | `src/client/`  | 판매사 소비자보호 담당                        |
| `/auditor/` | `auditor/index.html` | `src/auditor/` | 감독기관                                      |
| `/channel/` | `channel/index.html` | `src/channel/` | 증권사 앱 예시. FINVERIC API로 만든 고객 화면 |

- 페이지마다 번들을 따로 만든다. 한 페이지의 코드를 다른 페이지 폴더에서 import하지 않는다. 함께 쓰는 화면 요소, 스타일(`theme.css`, `ui.module.css`), API 클라이언트는 `src/shared/`에 둔다. API와 함께 쓰는 판정·계약만 `packages/core`(`@finveric/core`)에 둔다.
- 고객은 FINVERIC 화면을 직접 쓰지 않는다. 고객은 증권사 앱을 쓴다. `/channel/`은 증권사가 FINVERIC API로 만드는 앱의 예시다. 고객 화면은 이 페이지에만 둔다.
- 진입 화면과 판매사 콘솔은 `/channel/`과 API 문서(`/api/docs`)를 새 탭으로 연다. 주소는 `src/shared/links.ts`를 쓴다.
- 개발 서버는 하나다. 주소는 `http://127.0.0.1:5173/`다. `/client/*`, `/auditor/*`, `/channel/*`의 화면 요청은 그 페이지의 `index.html`로 보낸다. `/api`는 로컬 API로 넘긴다. 다른 포트의 API로 확인할 때는 `FINVERIC_API_URL`을 지정한다.
- 검증 설정은 사이트 루트의 `/deployment.json`이다. 개발 서버는 `public/`에서 읽는다(Git에 넣지 않는다). Vercel 빌드는 `deploy/<network>/deployment.json`을 넣는다.
- 빌드 결과(`dist/`)를 `scripts/build-vercel.mjs`가 그대로 사이트 루트에 둔다.
- 페이지를 더하거나 빼면 세 곳을 함께 바꾼다: `vite.config.ts`의 `pages`, 개발 서버의 화면 경로, `scripts/build-vercel.mjs`의 페이지 확인과 경로. 실행 중인 개발 서버(Docker 포함)는 다시 시작해야 새 페이지를 읽는다.
