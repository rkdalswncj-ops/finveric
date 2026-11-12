# core 작업 규칙

## 파일

| 파일              | 내용                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `src/index.ts`    | 공개 입구. 배포 설정·역할, 고객 가명 ID, 커밋먼트·회로 입력·증명 형식, 승인 원문, 증빙 형식 |
| `src/encoding.ts` | FIELD, 정렬한 JSON(`canonical`), bigint JSON                                                |
| `src/rules.ts`    | 진단 기준 원문, 검사, 기준 해시, 판정, 시연 기준 v1                                         |
| `src/products.ts` | 상품 설명서, 지문, 적합·녹취 대상 계산, 시연 상품                                           |
| `src/abi.ts`      | 원장 v5 ABI와 원장 오류 문구                                                                |
| `src/signals.ts`  | 위험 신호 5종과 기준값                                                                      |
| `src/ledger.ts`   | 원장 이벤트 읽기(`readLedger`). 감독기관 화면과 위험 신호가 쓴다                            |
| `src/verify.ts`   | 독립 검증(`verifySale`). 결과는 일치·불일치·기록 없음이다                                   |
| `src/api.ts`      | 판매사 API 계약(DTO, 요청 JSON Schema, 문서 전용 응답 스키마)                               |

- `index.ts`는 `encoding`, `rules`, `products`, `abi`, `signals`를 다시 내보낸다. `ledger.ts`, `verify.ts`, `api.ts`는 각 파일에서 import한다.
- `encoding.ts`, `rules.ts`, `products.ts`, `abi.ts`, `signals.ts`는 `index.ts`를 값으로 import하지 않는다. 순환 import가 생긴다.

## API 계약 (`src/api.ts`)

- 판매사 API의 요청·응답 DTO는 `src/api.ts`에만 정의한다. API와 웹은 이 타입을 가져다 쓴다. 각자 따로 타입을 만들지 않는다.
- 요청 DTO 옆에 JSON Schema를 둔다. 스키마는 `satisfies ObjectSchema<DTO>`로 선언한다. 필드 이름이 어긋나면 타입 검사가 실패한다.
- 응답은 두 가지로 쓴다. `...View`는 서버가 만드는 값(bigint 포함)이다. `...Dto`는 웹이 받는 값이다. `Wire<T>`가 bigint를 문자열로 바꾼다.
- 응답 스키마는 API 문서(`/api/openapi.json`) 전용이다. `responseSchema<Dto>(이름, 설명, properties, optional)`로 만든다. `properties`에 DTO의 모든 필드를, `optional`에 선택 필드를 적는다. 어긋나면 타입 검사가 실패한다. bigint 필드는 10진수 문자열(`DECIMAL`)로 적는다.
- 응답 스키마를 Fastify 경로의 `schema.response`에 넣지 않는다. 경로와 응답 스키마의 연결은 `apps/api/src/docs/operations.ts`에 둔다.
- 응답 DTO의 필드를 바꾸면 응답 스키마도 고친다. `tests/mvp.test.ts`가 실제 응답을 문서와 대조한다.
- 경로나 필드를 바꾸면 API 경로(`apps/api/src/routes/`)와 웹 호출부를 함께 고친다. `npm run typecheck`가 어긋난 곳을 알려 준다.

## 도메인 계산

- 웹, API, 스크립트가 함께 쓰는 판정·해시·커밋먼트·검증 로직과 원장 ABI를 둔다. 같은 계산을 다른 곳에 다시 만들지 않는다.
- 이 패키지는 브라우저에서도 실행된다. `node:fs` 같은 Node 전용 모듈과 snarkjs를 import하지 않는다.
- 진단 기준과 설명서는 정렬한 JSON(`canonical`) 원문으로 원장에 등록한다. 기준 해시와 설명서 지문은 이 원문으로 계산한다.
- 기준 필드, 커밋먼트, 공개 신호의 순서를 바꾸면 회로, 증명 키, Verifier, 원장을 다시 만든다. `tests/core.test.ts`의 시연 기준 해시가 바뀐다.
- 적합 여부와 녹취·숙려 대상 계산(`isSuitable`, `isProtectedSale`)은 원장과 같은 식이다. 원장을 바꾸면 함께 고친다.
- 원장 함수나 이벤트를 바꾸면 `contracts`와 `src/abi.ts`를 함께 맞춘다.
