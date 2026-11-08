# FINVERIC · 핀베릭 · UI/UX 레퍼런스

2026-11-08 KST · [기말 MVP PRD](fund-sales-verification-prd.md) · [디자인 기준](../DESIGN.md)

[클릭형 펀드 화면 시안](fund-ui-prototype.html)에서 아래 패턴을 조합한 모습을 확인할 수 있다. 시안의 거래·원장·증명은 모두 모의다. [상품 탐색](screenshots/fund-customer.png) · [기관 검토](screenshots/fund-review.png) · [처리 로그](screenshots/fund-chain.png) · [독립 검증](screenshots/fund-verify.png)

**상품 정보는 삼성자산운용을 참고한다. 고객의 확인 절차는 Toss TDS를 참고한다. 기관 업무는 Linear와 Stripe를 참고한다. 독립 검증은 TradeTrust를 참고한다. 웹 구조는 shadcn/ui로 구성한다.** 아래 적용안은 이 자료를 펀드 MVP에 맞게 조합한 설계 제안이다.

DESIGN.md의 색상, 글꼴, 고정 레퍼런스 버전은 유지한다. 새 화면의 역할과 상태는 기말 MVP PRD를 따른다. 기존 ELS HTML과 [이전 레퍼런스 문서](ui-ux-references.md)는 이전 시안의 기록이다.

## 확인한 범위

공식 제품 페이지, 공식 문서, 공식 저장소를 확인했다. Stripe, Linear, Etherscan, TradeTrust, shadcn/ui의 공식 화면 이미지를 직접 열었다. 금융 계정과 업무 계정에는 로그인하지 않았다. 거래와 파일 업로드도 실행하지 않았다.

로컬 브라우저 도구는 `Local browser use is disabled in Work settings`를 반환했다. 따라서 이번 조사에서 직접 캡처한 브라우저 스크린샷은 없다. 공개 HTML과 검색 색인으로 확인한 내용은 이미지 확인과 구분했다. 링크가 열려도 JavaScript 본문이 수집되지 않는 경우를 아래에 적었다.

| 레퍼런스 | 확인 방식 | 맡길 화면 |
| --- | --- | --- |
| 삼성자산운용 | 공개 상품 URL, 검색 색인, 사이트가 배포한 JavaScript를 확인했다. 상품 본문의 현재 렌더링은 확인하지 못했다. | 펀드 찾기, 상품 상세, 운용사 상품·문서 관리 |
| Toss / Toss TDS | 공개 WTS 일부와 공식 컴포넌트 예제·코드를 확인했다. 실제 가입 화면은 확인하지 못했다. | 진단, 설명 확인, 답변 검토, 모의 서명 |
| Linear | 공식 문서와 issue Activity 이미지를 확인했다. 로그인한 업무 화면은 확인하지 못했다. | 증권사 업무 목록, 재진단 검토 이력 |
| Stripe Workbench | 공식 문서와 Logs·Events 이미지를 확인했다. 계정의 실제 로그는 조회하지 않았다. | 온체인 처리 목록과 선택한 기록의 상세 |
| TradeTrust / Etherscan | 공식 검증 문서와 검증 결과·이벤트 로그 이미지를 확인했다. 갤러리와 Sepolia 실거래는 이번에 검증하지 못했다. | 독립 검증 결과와 원장 근거 |
| shadcn/ui | 공개 dashboard-01 예제의 HTML·코드·공식 이미지를 확인했다. | 역할 사이드바, 요약 카드, 업무 표 |

## 1. 삼성자산운용: 상품과 판매사를 구분하는 탐색

바로 볼 화면은 [펀드 찾기](https://www.samsungfund.com/fund/product/list.do), [삼성글로벌반도체 온라인 Ce 클래스 상세](https://www.samsungfund.com/fund/product/view.do?id=K55105DN1515), [펀드 판매사 안내](https://www.samsungfund.com/fund/product/fund-seller.do)다. 목록과 상세 URL은 공개다. 현재 HTML 수집 결과에는 공통 메뉴만 남았다. 상세의 클래스와 공시 이력은 공식 페이지의 검색 색인에서 확인했다. 사이트의 [공개 JavaScript](https://www.samsungfund.com/assets/js/product.js)에는 투자위험, 기준가, 총 보수(연), 순자산, 상품 상세, 판매사 안내의 구성과 문구가 있다.

공개 상품 상세는 클래스별 보수·수수료와 판매사를 구분한다. 설명서와 공시도 연결한다. 다른 상품의 공개 상세에서도 판매사를 선택하면 해당 판매사 홈페이지로 이동한다고 안내한다. [상품 상세와 판매사 안내](https://www.samsungfund.com/fund/product/view.do?id=K55105EU7389) · [클래스별 보수 안내](https://www.samsungfund.com/fund/product/view.do?id=K55105D34215)

**가져올 것.** 카드에 상품명, 운용사, 판매사, 위험등급, 연 보수, 투자 전략을 같은 순서로 둔다. 위험등급에는 숫자와 설명을 함께 쓴다. 상세에서는 클래스, 비용 항목, 설명서 버전을 확인한다. 운용사는 상품·문서 버전을 관리한다. 판매사는 해당 버전으로 가입 절차를 진행한다.

**절충점.** MVP의 가입 가능한 상품은 한 개다. 카드는 탐색 구조를 보여 주는 데 쓴다. 다른 카드가 있으면 `둘러보기`처럼 가능한 행동을 표시한다. 실제 상품의 수익률과 보수 숫자를 가상 펀드에 복사하지 않는다. 상품 카드의 넓은 여백과 배치는 MVP 제안이며 삼성의 현재 화면을 그대로 재현한 결과는 아니다.

## 2. Toss: 고객이 지금 해야 할 행동을 선명하게 표시

공개 제품 링크는 [토스증권 홈](https://www.tossinvest.com/)과 [주식 골라보기](https://www.tossinvest.com/screener)다. 홈의 메뉴와 실시간 차트 제목은 확인했다. 수집 환경에서는 브라우저 지원 안내도 반환됐다. 종목 상세와 로그인 후 주문 흐름의 시각 배치는 확인하지 못했다.

구체적인 확인 화면은 공식 [TDS AgreementV4](https://tossmini-docs.toss.im/tds-mobile/components/Agreement/v4/)다. 예제는 체크박스, 필수·선택 표시, 설명, 펼치기, 동의 항목 그룹을 제공한다. 이 자료는 실제 펀드 가입 화면이 아니라 공개 컴포넌트 예제다.

**가져올 것.** 진단은 한 열로 둔다. 한 화면에서 한 문항에 답한다. 질문 아래에 선택지를 두고 다음 행동을 큰 버튼 하나로 표시한다. 설명 확인은 핵심 설명과 해당 문서 버전을 연결한다. 서명 직전에는 답변, 진단 회차, 문서 버전을 다시 보여 준다. 필수 여부는 글자로 적는다. 구현은 shadcn/ui의 선택·동의 컴포넌트로 구성한다.

**절충점.** 접기 기능은 긴 보조 설명에 쓴다. 원금 손실 안내와 필수 확인은 기본 화면에 보인다. 세 번째 진단의 `추가 검토 필요`도 다음 버튼 근처에 표시한다. 모바일 컴포넌트를 데스크톱 전체 폭으로 늘리지 않는다. 고객의 진단 영역에는 DESIGN.md의 한 열 규칙을 적용한다.

## 3. Linear: 한 판매 건을 업무 단위로 관리

확인할 자료는 [Display options](https://linear.app/docs/display-options)와 [Comments and reactions](https://linear.app/docs/comment-on-issues)다. 공식 문서는 상태·담당자별 그룹, 표시 속성, 정렬을 설명한다. [공식 issue Activity 이미지](https://webassets.linear.app/images/ornj730p/production/ec0d3a41ec497dbb27653e26110d8a3cac29b964-1203x796.png)에는 설명 아래에 생성·변경·댓글이 이어진다. 행마다 행위자와 시각이 있다.

**가져올 것.** 증권사 목록의 한 행을 판매 ID 하나로 잡는다. 열에는 상품, 판매 절차 상태, 진단 회차 수, 누락 항목, 담당자, 갱신 시각을 둔다. 상태 탭은 `진행 중 / 추가 검토 필요 / 가입 조건 검증 완료`로 나눈다. 선택한 건에서는 진단 1·2·3회차, 설명 확인, 모의 서명, 추가 검토를 시간순으로 표시한다. 앞선 미충족 회차도 남긴다.

**절충점.** Linear의 Activity는 업무 협업 패턴이다. 우리 검증 근거는 RPC와 컨트랙트 기록에서 확인해야 한다. 담당자 메모와 원장 이벤트는 출처를 표시한다. 목록에서 상태 배지를 바꾸는 행동만으로 검증 절차가 완료되지 않게 한다. 이 상태 규칙은 [기말 MVP PRD](fund-sales-verification-prd.md)를 따른다.

## 4. Stripe Workbench: 로그 목록과 근거를 함께 확인

정확한 문서는 [How Workbench works의 Logs·Events](https://docs.stripe.com/workbench/overview#view-api-request-logs)다. 직접 확인한 화면은 [공식 Logs 이미지](https://b.stripecdn.com/docs-statics-srv/assets/workbench-logs.eca1ad610d58aa7493eff9d064a659d9.png)와 [공식 Events 이미지](https://b.stripecdn.com/docs-statics-srv/assets/workbench-events.45cfc616e1e6b03ac93673581b47b8ba.png)다. 상단에는 ID 검색과 필터가 있다. 왼쪽에는 시각과 상태를 포함한 목록이 있다. 오른쪽에는 선택한 요청의 상세와 JSON이 있다. [실제 Workbench](https://dashboard.stripe.com/workbench/logs)는 계정이 필요하다.

**가져올 것.** 온체인 처리 화면은 왼쪽 로그와 오른쪽 상세로 구성한다. 로그에 판매 ID, 단계, 출처, 상태, 시각을 표시한다. 상세에는 확보한 요청 ID, 거래 해시, 영수증, 이벤트, 상태 대조 결과를 둔다. JSON은 펼쳐서 확인한다. 마지막 조회 시각과 새로고침 동작을 표시한다.

**절충점.** `증명 생성 서버`, `판매사 API`, `Sepolia RPC`를 서로 다른 출처로 적는다. 증명 유효성과 진단 조건 충족 여부도 구분한다. `통과=false`인 유효한 증명이 앞선 진단을 기록할 수 있기 때문이다. 거래 제출 후에는 해시를 표시한다. 성공 영수증과 해당 판매 ID의 이벤트·상태를 대조한 뒤 절차 상태를 갱신한다. 상단 그래프보다 한 판매 건의 근거 확인에 화면을 배정한다. 이 적용안의 처리 의미는 [기말 MVP PRD](fund-sales-verification-prd.md)와 [Ethereum 거래 영수증 규격](https://ethereum.org/developers/docs/apis/json-rpc/#eth_gettransactionreceipt)을 따른다.

## 5. TradeTrust: 독립 검증을 항목별 결과로 표시

제품 진입점은 [TradeTrust Reference Implementation](https://ref.tradetrust.io/)과 [공식 샘플 갤러리](https://gallery.tradetrust.io/)다. 공식 사이트는 문서 선택·끌어놓기와 갤러리를 안내한다. 이번 조사에서 갤러리는 시간 초과가 났다. Reference Implementation도 JavaScript 본문을 수집하지 못했다. 파일 선택 이후의 실제 결과 화면은 재확인하지 못했다. [공식 제품 안내](https://www.tradetrust.io/) · [공식 UI 저장소](https://github.com/TradeTrust/tradetrust-website)

검증 항목은 공식 [V4 IDVC 검증 문서](https://docs.tradetrust.io/docs/4.x/reference/tradetrust-v4/verifying-v4-idvc-document/)와 [고정한 문서 원본](https://github.com/TradeTrust/documentation/blob/e728934a7ce87613bb8638f32f6d0ce50e77bacd/versioned_docs/version-4.x/reference/tradetrust-v4/verifying-v4-idvc-document.md)에서 확인했다. 문서는 무결성, 발급 상태, 발급자 신원을 나눈다. 직접 확인한 [공식 결과 이미지](https://raw.githubusercontent.com/TradeTrust/documentation/e728934a7ce87613bb8638f32f6d0ce50e77bacd/static/docs/verifying-documents/2-ticks.png)는 두 항목에 성공을 표시한다. 발급자 신원에는 실패와 사유를 별도로 표시한다. 이 문서는 V4를 beta로 설명한다.

**가져올 것.** 독립 검증 화면은 판매 ID 조회와 고객 파일 선택을 제공한다. 결과를 `상품·문서 버전 / 원본 무결성 / 진단 증명 / 필수 기록 / 원장 상태`로 나눈다. 각 행에는 결과와 근거를 함께 둔다. 일부 항목만 실패해도 다른 항목의 확인 결과는 유지한다. `기록 없음`, `원본 불일치`, `원장 조회 실패`는 다른 문구로 표시한다. 파일이 가리킨 임의의 주소 대신 사전에 정한 원장을 조회한다. 구체적인 항목과 신뢰 기준은 [기말 MVP PRD](fund-sales-verification-prd.md)를 따른다.

**원장 상세 보조: Etherscan.** [공식 Event Logs 문서](https://info.etherscan.com/what-is-event-logs/)와 [공식 Logs 이미지](https://info.etherscan.com/what-is-event-logs/images/2023/09/image-31.png)를 확인했다. 이미지는 발행 계약 주소, 해석한 이벤트 이름, Topics, Data를 나눈다. 우리 화면은 검증 결과 아래에 네트워크, 컨트랙트, 거래 해시, 영수증, 해당 판매 ID의 이벤트를 보여 준다. 복사와 탐색기 링크를 제공한다. [Sepolia 거래 목록](https://sepolia.etherscan.io/txs)은 이번 조회에서 HTTP 403을 반환했다. 이 문서는 실제 MVP의 배포나 거래 성공을 확인한 기록이 아니다.

**절충점.** TradeTrust의 발급자 신원 검사를 금융기관의 공인 신원 확인으로 표시하지 않는다. MVP는 등록한 가상 기관·키와 비교한 결과를 표시한다. Etherscan의 거래 성공도 펀드 매입 완료를 뜻하지 않는다. 화면 상단에는 판매 절차와 모의 매입 상태를 별도로 둔다. ZKP가 확인하는 계산 조건과 실제 설명·입력 사실성의 범위도 [기말 MVP PRD](fund-sales-verification-prd.md)에 맞춰 적는다.

## 6. shadcn/ui: 한 웹의 역할 구조와 업무 표

로그인 없이 열어볼 예제는 [dashboard-01](https://ui.shadcn.com/view/new-york-v4/dashboard-01)이다. 공개 HTML에는 사이드바, 요약 지표, 상태·검토자 열을 가진 표, 페이지 이동이 있다. [공식 이미지](https://ui.shadcn.com/r/styles/new-york/dashboard-01-light.png)에서도 같은 배치를 확인했다. [Blocks의 코드](https://ui.shadcn.com/blocks/dashboard)는 사이드바·카드·차트·표를 별도 구성으로 나눈다. 필요한 동작은 공식 [Sidebar](https://ui.shadcn.com/docs/components/sidebar)와 [Data Table](https://ui.shadcn.com/docs/components/data-table)에서 확인한다.

**가져올 것.** 사이드바를 `사용자 / 관리자`로 묶는다. 사용자는 펀드 찾기·가입하기·내 가입 기록을 연다. 관리자는 운용사·증권사·온체인 처리·독립 검증을 연다. 상단에는 현재 역할과 선택한 판매 ID를 표시한다. 업무 요약 카드는 상태별 건수를 표시한다. 카드나 상태 탭을 선택하면 표를 좁힌다.

**절충점.** 예제의 매출 차트와 모든 메뉴를 그대로 넣으면 시연의 핵심이 흐려진다. 업무 표와 선택한 건의 상세에 공간을 준다. 표의 열 설정·검색·페이지 이동은 데이터가 필요로 하는 범위에서 구현한다. 사이드바의 역할 전환은 시연용 UI다. 실제 권한은 서버와 컨트랙트에서도 확인해야 한다. 이 문서는 패키지를 설치하거나 전체 블록 도입을 결정하지 않는다.

## 국내 사이드 프로젝트에서 가져올 범위

[디프만 Layer](https://github.com/depromeet/layer)는 보조 참고로 남긴다. 팀 README는 템플릿 추천, 회고 작성, 요약, 분석 흐름을 설명한다. 이 흐름은 질문에 답한 뒤 전체 내용을 확인하는 구성에 참고할 수 있다. 서비스 목적은 회고 관리다. 금융 적합성 판단과 원장 검증의 근거로 쓰지는 않는다. [공개 서비스](https://www.layerapp.io/)는 이번 수집에서 읽을 수 있는 본문을 반환하지 않았다. 현재 UI와 타임라인을 직접 확인했다고 판단하지 않는다.

SOPT·DND·YAPP의 조직 목록만으로 금융 화면 적합성을 판단하지 않는다. 이번 문서에는 구체적인 화면이나 원본을 확인한 사례만 넣었다.

## MVP에 적용할 우선순위

| 순서 | 구현할 화면 | 확인할 행동 |
| --- | --- | --- |
| 1 | 펀드 카드와 상세 | 운용사·판매사·위험·비용·전략·문서 버전을 읽는다. |
| 2 | 고객 진단과 모의 서명 | 세 회차와 앞선 결과를 본다. 최종 답변과 문서를 확인한다. |
| 3 | 증권사 업무 목록과 상세 | 재진단 경고와 누락 항목을 찾는다. 추가 검토 결과를 기록한다. |
| 4 | 온체인 처리 | 증명·API·제출·영수증·이벤트·상태 대조의 출처를 확인한다. |
| 5 | 독립 검증 | 고객 파일과 고정 원장을 대조한다. 항목별 결과와 실패 사유를 읽는다. |

화면은 밝은 배경과 파란 주요 동작을 공유한다. 고객 화면에는 질문과 다음 행동을 먼저 둔다. 기관 화면에는 상태와 근거를 먼저 둔다. 실제 ZKP·Sepolia 처리와 모의 본인확인·서명·매입은 표시를 구분한다. 배포 주소와 실제 거래 링크는 구현 검증 후 추가한다.
