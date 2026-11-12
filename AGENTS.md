# 프로젝트 작업 지침

UI를 추가하거나 수정하기 전에 [DESIGN.md](DESIGN.md)를 읽는다. 화면 구성, 문구, 테마, 컴포넌트에 이 파일의 규칙을 적용한다. 가입 조건과 원장 상태는 [MVP PRD](docs/prd.md)를 따른다.

## 구조

FINVERIC은 판매사(B2B)와 감독기관(B2G)이 쓰는 서비스다. 고객(투자자)은 FINVERIC 화면을 직접 쓰지 않는다.

| 위치                    | 내용                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `apps/web`              | 웹. 진입 화면(`/`), 판매사 콘솔과 판매 채널 시연(`/client/`), 감독기관 화면(`/auditor/`) |
| `apps/api`              | Fastify API. 로컬은 Node 프로세스, 외부 시연은 Vercel 함수                               |
| `packages/core`         | 판정·해시·커밋먼트·검증 로직, ABI, API 계약(DTO). 웹과 API가 함께 쓴다                   |
| `packages/ui`           | 웹 페이지들의 공통 화면 요소와 API 클라이언트                                            |
| `circuits`, `contracts` | ZKP 회로와 원장                                                                          |
| `deploy/<network>`      | Vercel 빌드에 쓰는 원장 배포본                                                           |
| `scripts`               | 개발·배포·시연 스크립트                                                                  |
| `docs`                  | 문서. [README의 주요 문서 표](README.md#-주요-문서)를 따른다                             |

하위 폴더의 AGENTS.md가 그 영역의 규칙을 더한다. 이 파일과 충돌하면 더 가까운 폴더의 파일을 따른다.

## 공통 규칙

- 사실 하나는 문서 하나에만 적는다. 배포 정보는 [docs/deploy.md](docs/deploy.md), 결정은 [docs/adr](docs/adr/)에 둔다. 결정을 바꾸면 ADR을 추가한다.
- 개인키, `DEMO_TOKEN`, 고객 원본(`.local/`), `.env.*`를 커밋하지 않는다. 채팅에도 옮기지 않는다.
- 개인 설정(`.agents/`, `.claude/`, `.impeccable/`, `.mise.toml`, `PRODUCT.md`)과 개인 배포(`hosting/`, `scripts/sites-*`)는 원격 저장소에 올리지 않는다. 문서에 개인 계정이 드러나는 주소를 쓰지 않는다.
- 사용자가 실행 중인 시연 서버(Anvil, API, 웹)를 끄거나 그 기록을 바꾸지 않는다. 검사는 다른 포트와 임시 디렉터리를 쓴다.
- 변경 뒤 `npm run typecheck`와 `npm test`를 실행한다. 원장은 `npm run contracts:test`도 실행한다. 실행 환경을 바꾸면 `docker compose up --build`로도 확인한다.
- 의존성은 정확한 버전으로 고정한다(`.npmrc`의 `save-exact`).
