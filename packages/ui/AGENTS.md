# ui 패키지 작업 규칙

웹(`apps/web`)의 페이지들이 함께 쓰는 화면 요소다. 바꾸면 진입 화면, client, auditor, channel을 모두 확인한다. 디자인 규칙은 루트 [DESIGN.md](../../DESIGN.md)를 따른다.

| 파일                      | 내용                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/Shell.tsx`           | 사이드 메뉴, 상단 막대, 오류·진행 표시(`Shell`, `NavGroup`). `entryHref`는 진입 화면 링크, `links`는 그 아래의 새 탭 링크, `foot`은 선택 |
| `src/components.tsx`      | `Badge`, `Notice`, `Heading`, `Empty`, `Facts`, `TransactionFacts`, `AccessCodeForm`, `Stat`(요약 수치 카드)                             |
| `src/button.tsx`          | `Button`                                                                                                                                 |
| `src/api.ts`              | 판매사 API 클라이언트(`api`)와 JSON 내려받기(`saveFile`)                                                                                 |
| `src/deployment.ts`       | 사이트 루트의 `/deployment.json`을 읽는 `useDeployment`                                                                                  |
| `src/format.ts`           | 표기 형식: 해시 줄임(`short`), 금액(`won`), 한국 시간(`dateTime`), 네트워크 이름                                                         |
| `src/sales.ts`            | client와 channel이 함께 쓰는 판매 건 상태, 상품·기준 찾기, 투자성향·위험등급 표시                                                        |
| `src/sale-components.tsx` | client와 channel이 함께 쓰는 판매 건 상태 배지(`StatusBadge`), 핵심 설명 카드(`ExplanationCards`)                                        |
| `src/links.ts`            | 다른 페이지로 가는 주소: 증권사 앱 예시(`/channel/`), API 문서(`/api/docs`)                                                              |
| `src/theme.css`           | 테마 토큰과 기본 요소 스타일                                                                                                             |
| `src/ui.module.css`       | 화면 틀과 공통 클래스. 페이지 CSS 모듈과 합칠 때 같은 클래스 이름을 다시 정의하지 않는다                                                 |

- 테마 토큰(색, 글자 크기 `--type-*`, 줄 높이, 고정폭 글꼴)은 `src/theme.css`의 `:root`에만 정의한다. DESIGN.md와 같은 값을 쓴다. CSS 모듈에는 px 글자 크기와 hex 색을 쓰지 않는다.
- 두 페이지 이상이 쓰는 표시 계산과 요소만 둔다. 한 페이지만 쓰는 화면이나 업무 규칙은 여기에 두지 않는다. 그 페이지의 폴더(`apps/web/src/<페이지>/`)에 둔다. 판정과 계산은 `packages/core`에 둔다.
- `src/api.ts`는 판매사 API 클라이언트다. auditor 페이지는 이 클라이언트로 GET만 보낸다.
- `api<T>()`의 `T`와 요청 본문 타입은 `packages/core/src/api.ts`의 DTO를 쓴다. 요청 본문에는 `satisfies DiagnoseRequest`처럼 DTO를 붙인다. 화면에서 응답 타입을 손으로 만들지 않는다.
- `public/`의 `deployment*.json`은 `scripts/deploy.ts`와 `scripts/dev.ts`가 쓴다. Git에 넣지 않는다. Vercel 빌드는 `deploy/<network>/deployment.json`을 사이트 루트에 넣는다.
