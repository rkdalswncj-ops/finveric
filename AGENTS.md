# 프로젝트 작업 지침

UI를 추가하거나 수정하기 전에 [DESIGN.md](DESIGN.md)를 읽는다. 화면 구성, 문구, 테마, 컴포넌트에 이 파일의 규칙을 적용한다. 가입 조건과 원장 상태는 [MVP PRD](docs/prd.md)를 따른다.

## 구조

FINVERIC은 B2B·B2G 서비스다. 투자자는 FINVERIC 화면을 직접 쓰지 않는다.

| 위치                    | 내용                                                                   |
| ----------------------- | ---------------------------------------------------------------------- |
| `apps/client`           | 운용사·증권사·준법 담당자(B2B) 화면과 판매 채널 시연                   |
| `apps/auditor`          | 감독기관·외부 검증자(B2G)의 독립 검증 화면                             |
| `apps/api`              | Fastify API. 로컬은 Node 프로세스, 외부 시연은 Vercel 함수             |
| `packages/core`         | 판정·해시·커밋먼트·검증 로직, ABI, API 계약(DTO). 웹과 API가 함께 쓴다 |
| `packages/ui`           | 두 웹 앱의 공통 화면 요소와 API 클라이언트                             |
| `circuits`, `contracts` | ZKP 회로와 원장                                                        |
| `deploy/<network>`      | Vercel 빌드에 쓰는 원장 배포본                                         |
| `scripts`               | 개발·배포·시연 스크립트                                                |
| `docs`                  | 문서. [README의 문서 표](README.md#문서)를 따른다                      |

하위 폴더의 AGENTS.md가 그 영역의 규칙을 더한다. 이 파일과 충돌하면 더 가까운 폴더의 파일을 따른다.

## 공통 규칙

- 사실 하나는 문서 하나에만 적는다. 배포 정보는 [docs/deploy.md](docs/deploy.md), 결정은 [docs/adr](docs/adr/)에 둔다. 결정을 바꾸면 ADR을 추가한다.
- 개인키, `DEMO_TOKEN`, 고객 원본(`.local/`), `.env.*`를 커밋하지 않는다. 채팅에도 옮기지 않는다.
- 사용자가 실행 중인 시연 서버(API, Anvil, Sites 브리지, 터널)를 끄거나 그 기록을 바꾸지 않는다. 검사는 다른 포트와 임시 디렉터리를 쓴다.
- 변경 뒤 `npm run typecheck`와 `npm test`를 실행한다. 원장은 `npm run contracts:test`, Sites는 `npm run sites:test`도 실행한다.
- 의존성은 정확한 버전으로 고정한다(`.npmrc`의 `save-exact`).
