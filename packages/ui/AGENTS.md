# ui 패키지 작업 규칙

웹(`apps/web`)의 페이지들이 함께 쓰는 화면 요소다. 바꾸면 진입 화면, client, auditor를 모두 확인한다. 디자인 규칙은 루트 [DESIGN.md](../../DESIGN.md)를 따른다.

| 파일                 | 내용                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `src/Shell.tsx`      | 사이드 메뉴, 상단 막대, 오류·진행 표시(`Shell`, `NavGroup`)                              |
| `src/components.tsx` | `Badge`, `Notice`, `Heading`, `Facts`, `TransactionFacts`, `AccessCodeForm`              |
| `src/button.tsx`     | `Button`                                                                                 |
| `src/api.ts`         | 판매사 API 클라이언트(`api`)와 JSON 내려받기(`saveFile`)                                 |
| `src/deployment.ts`  | 사이트 루트의 `/deployment.json`을 읽는 `useDeployment`                                  |
| `src/format.ts`      | 표기 형식: 해시 줄임(`short`), 금액(`won`), 한국 시간(`dateTime`), 네트워크 이름         |
| `src/theme.css`      | 테마 토큰과 기본 요소 스타일                                                             |
| `src/ui.module.css`  | 화면 틀과 공통 클래스. 페이지 CSS 모듈과 합칠 때 같은 클래스 이름을 다시 정의하지 않는다 |

- 테마 토큰은 `src/theme.css`에만 정의한다. DESIGN.md의 색과 같은 값을 쓴다.
- 한 페이지만 쓰는 화면이나 업무 규칙은 여기에 두지 않는다. 그 페이지의 폴더(`apps/web/src/<페이지>/`)에 둔다. 판정과 계산은 `packages/core`에 둔다.
- `src/api.ts`는 판매사 API 클라이언트다. auditor 페이지는 이 클라이언트로 GET만 보낸다.
- `api<T>()`의 `T`와 요청 본문 타입은 `packages/core/src/api.ts`의 DTO를 쓴다. 요청 본문에는 `satisfies DiagnoseRequest`처럼 DTO를 붙인다. 화면에서 응답 타입을 손으로 만들지 않는다.
- `public/`의 `deployment*.json`은 `scripts/deploy.ts`와 `scripts/dev.ts`가 쓴다. Git에 넣지 않는다. Vercel 빌드는 `deploy/<network>/deployment.json`을 사이트 루트에 넣는다.
