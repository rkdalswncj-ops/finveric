# core 작업 규칙

## API 계약 (`src/api.ts`)

- 판매사 API의 요청·응답 DTO는 `src/api.ts`에만 정의한다. API와 웹은 이 타입을 가져다 쓴다. 각자 따로 타입을 만들지 않는다.
- 요청 DTO 옆에 JSON Schema를 둔다. 스키마는 `satisfies ObjectSchema<DTO>`로 선언한다. 필드 이름이 어긋나면 타입 검사가 실패한다.
- 응답은 두 가지로 쓴다. `...View`는 서버가 만드는 값(bigint 포함)이다. `...Dto`는 웹이 받는 값이다. `Wire<T>`가 bigint를 문자열로 바꾼다.
- 경로나 필드를 바꾸면 API 경로(`apps/api/src/app.ts`)와 웹 호출부를 함께 고친다. `npm run typecheck`가 어긋난 곳을 알려 준다.

## 도메인 계산

- 웹, API, 스크립트가 함께 쓰는 판정·해시·커밋먼트·검증 로직과 원장 ABI를 둔다. 같은 계산을 다른 곳에 다시 만들지 않는다.
- 이 패키지는 브라우저에서도 실행된다. `node:fs` 같은 Node 전용 모듈을 import하지 않는다.
- 커밋먼트나 공개 입력의 순서를 바꾸면 회로, Verifier, 원장을 다시 배포해야 한다. `npm test`의 회로·브라우저 교차 검사를 확인한다.
- 원장 함수나 이벤트를 바꾸면 `contracts`와 ABI를 함께 맞춘다.
