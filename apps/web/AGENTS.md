# web 앱 작업 규칙

웹은 Vite 앱 하나에 페이지 세 개다. 화면을 고치기 전에 루트 [DESIGN.md](../../DESIGN.md)를 읽는다. [결정 기록](../../docs/adr/0006-seller-console-and-single-web-app.md)

| 경로        | HTML                 | 코드           | 사용자                                 |
| ----------- | -------------------- | -------------- | -------------------------------------- |
| `/`         | `index.html`         | `src/entry/`   | 모두. 역할 선택과 원장 상태            |
| `/client/`  | `client/index.html`  | `src/client/`  | 판매사 소비자보호 담당. 판매 채널 포함 |
| `/auditor/` | `auditor/index.html` | `src/auditor/` | 감독기관                               |

- 페이지마다 번들을 따로 만든다. 한 페이지의 코드를 다른 페이지 폴더에서 import하지 않는다. 함께 쓰는 요소는 `packages/ui`에 둔다.
- 고객은 FINVERIC 화면을 직접 쓰지 않는다. 고객 화면은 client의 판매 채널(증권사 앱 재현)에만 있다.
- 개발 서버는 하나다. 주소는 `http://127.0.0.1:5173/`다. `/client/*`, `/auditor/*`의 화면 요청은 그 페이지의 `index.html`로 보낸다. `/api`는 로컬 API로 넘긴다. 다른 포트의 API로 확인할 때는 `FINVERIC_API_URL`을 지정한다.
- 검증 설정은 사이트 루트의 `/deployment.json`이다. 개발 서버는 `packages/ui/public/`에서 읽는다. Vercel 빌드는 `deploy/<network>/deployment.json`을 넣는다.
- 빌드 결과(`dist/`)를 `scripts/build-vercel.mjs`가 그대로 사이트 루트에 둔다.
