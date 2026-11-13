# ui 패키지 작업 규칙

웹(`apps/web`)의 페이지들이 함께 쓰는 화면 요소다. 바꾸면 진입 화면, client, auditor, channel을 모두 확인한다. 디자인 규칙은 루트 [DESIGN.md](../../DESIGN.md)를 따른다.

| 파일                      | 내용                                                                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/Shell.tsx`           | 사이드 메뉴, 상단 막대, 오류 알림(닫기 버튼 없음), 상태 줄(`Shell`, `NavGroup`). `entryHref`는 진입 화면 링크, `links`는 그 아래의 새 탭 링크, `foot`은 선택. 문서 제목과 경로가 바뀔 때의 초점을 맡는다       |
| `src/components.tsx`      | `Badge`, `Notice`(색은 `Tone`), `Heading`, `Empty`, `Facts`, `TransactionFacts`, `AccessCodeForm`, `FieldError`(입력 칸 오류), `TableScroll`(가로 스크롤 표), `Stat`(요약 수치 카드), `ConfirmDialog`(확인 창) |
| `src/focus.ts`            | 초점 이동: 화면 제목으로(`focusPageTitle`), 구역 제목으로(`focusElement`), 누른 요소가 사라졌을 때(`useFocusRescue`)                                                                                           |
| `src/button.tsx`          | `Button`. 누를 수 없는 상태는 `busy`(처리 중), `blocked`(아직 누를 수 없음), `disabled`(정말 쓸 수 없음)                                                                                                       |
| `src/api.ts`              | 판매사 API 클라이언트(`api`), 오류(`ApiError`), 읽기 상태(`LoadState`), JSON 내려받기(`saveFile`)                                                                                                              |
| `src/deployment.ts`       | 사이트 루트의 `/deployment.json`을 읽는 `useDeployment`                                                                                                                                                        |
| `src/format.ts`           | 표기 형식: 해시 줄임(`short`), 금액(`won`), 한국 시간(`dateTime`), 네트워크 이름                                                                                                                               |
| `src/sales.ts`            | client와 channel이 함께 쓰는 판매 건 상태, 상품·기준 찾기, 투자성향·위험등급 표시                                                                                                                              |
| `src/sale-components.tsx` | client와 channel이 함께 쓰는 판매 건 상태 배지(`StatusBadge`), 핵심 설명 카드(`ExplanationCards`)                                                                                                              |
| `src/links.ts`            | 다른 페이지로 가는 주소: 증권사 앱 예시(`/channel/`), API 문서(`/api/docs`)                                                                                                                                    |
| `src/theme.css`           | 테마 토큰과 기본 요소 스타일                                                                                                                                                                                   |
| `src/ui.module.css`       | 화면 틀과 공통 클래스. 페이지 CSS 모듈과 합칠 때 같은 클래스 이름을 다시 정의하지 않는다                                                                                                                       |

- 테마 토큰(색, 그림자·덮개, 글자 크기 `--type-*`, 줄 높이, 반경 `--rounded-*`, 고정폭 글꼴)은 `src/theme.css`의 `:root`에만 정의한다. DESIGN.md와 같은 값을 쓴다. CSS 모듈에는 px 글자 크기와 hex·rgb 색을 쓰지 않는다. 반경은 `--rounded-*`를 쓴다. 배지(5px), 진행 막대, 원형 아이콘만 예외다.
- hover 스타일은 `@media (hover: hover)` 안에만 둔다.
- 누른 버튼과 처리 중인 버튼에는 네이티브 `disabled`를 쓰지 않는다. `Button`의 `busy`나 `blocked`를 쓴다(`aria-disabled`). 초점과 Tab 순서가 남는다. 규칙은 DESIGN.md의 Interaction이다.
- 화면 제목은 `tabIndex={-1}`이다(`Heading`의 `h1`, `Empty`의 `h2`). 경로가 바뀌거나 누른 요소가 사라지면 초점을 받는다. 화면에 새 제목을 만들 때도 같은 규칙을 따른다.
- 가로로 스크롤하는 표는 `TableScroll`에 넣는다. `.tableWrap`을 직접 쓰지 않는다. `label`은 표 제목과 같은 글이다.
- 입력 칸의 오류는 `FieldError`로 보여 준다. 입력 칸에 `aria-invalid`와 `aria-describedby`(오류 id)를 단다.
- `Badge`와 `Notice`의 `tone`은 `Tone`(`neutral`, `info`, `success`, `warning`, `danger`)이다. 상태 색 표(`sales.ts`의 `STATUS_TONES` 등)도 `Tone`으로 적는다.
- 두 페이지 이상이 쓰는 표시 계산과 요소만 둔다. 한 페이지만 쓰는 화면이나 업무 규칙은 여기에 두지 않는다. 그 페이지의 폴더(`apps/web/src/<페이지>/`)에 둔다. 판정과 계산은 `packages/core`에 둔다.
- `src/api.ts`는 판매사 API 클라이언트다. auditor 페이지는 이 클라이언트로 GET만 보낸다.
- API 응답을 해석하는 곳은 `api()` 하나다. 실패하면 `ApiError`를 던진다. 서버에 닿지 못했거나 본문이 JSON이 아니면 `code`가 `offline`이고 문장은 `OFFLINE_MESSAGE`(합니다체)다. 고객 화면은 `code`로 고객 문장을 고른다.
- `api<T>()`의 `T`와 요청 본문 타입은 `packages/core/src/api.ts`의 DTO를 쓴다. 요청 본문에는 `satisfies DiagnoseRequest`처럼 DTO를 붙인다. 화면에서 응답 타입을 손으로 만들지 않는다.
- `public/`의 `deployment*.json`은 `scripts/deploy.ts`와 `scripts/dev.ts`가 쓴다. Git에 넣지 않는다. Vercel 빌드는 `deploy/<network>/deployment.json`을 사이트 루트에 넣는다.
