# ELS 판매절차 검증망 UI 레퍼런스

프로젝트에서 적용할 디자인 규칙과 고정한 레퍼런스 버전은 [DESIGN.md](../DESIGN.md)에 있다.

2026-11-06 KST · 증권사 공개 가이드와 화면 캡처, 공개 원장 거래, 공식 문서 검증 데모를 확인했다. 증권사 계좌에는 로그인하지 않았다. 실제 청약이나 거래를 제출하지 않았다. 아래 적용안의 상품과 규칙은 [기말 MVP](els-zkp-mvp-prd.md)를 따른다.

## 고객 청약

| 레퍼런스 | 확인한 화면과 흐름 |
| --- | --- |
| KB증권 웹 | 상단에 상품검색 → 청약신청 → 청약정보확인 → 청약결과를 표시한다. 신청 화면에는 청약가능금액, 수량, 확인사항이 있다. 가이드는 투자성향에 맞지 않는 상품에서 부적합·부적정거래확인서가 활성화된다고 설명한다. 결과 화면에는 접수 내용과 내역조회 버튼이 있다. 2026년 발행 상품의 공개 상세 화면에서도 같은 네 단계를 확인했다. [공식 가이드](https://www.kbsec.com/go.able?linkcd=s060100100001) · [상품검색 캡처](https://www.kbsec.com/images/cs/hp_els01.jpg) · [청약신청 캡처](https://www.kbsec.com/images/cs/hp_els02.jpg) · [청약정보확인 캡처](https://www.kbsec.com/images/cs/hp_els03.jpg) · [청약결과 캡처](https://www.kbsec.com/images/cs/hp_els04.jpg) · [제4469호 상품 상세](https://www.kbsec.com/go.able?gds_cd=KR6KB0008GK4&linkcd=s010201010000&pageGb=R&sbs_cd=D4469) |
| KB증권 M-able | 중개형 ISA 가이드에서 자산/상품/연금 → ELS/DLS → 청약중인 ELS/DLS 경로를 안내한다. 상품 상세를 확인한 뒤 계좌와 청약 금액을 입력한다. 공개 가이드에서 경로를 확인했다. [M-able 이용 안내 3절](https://www.kbsec.com/go.able?linkcd=m05080010) |
| 신한투자증권 HTS `#5963` | 공식 매뉴얼의 신청 화면에 핵심설명서, 투자설명서, 투자위험고지서와 각각의 확인 항목이 있다. 계좌별청약현황의 표는 청약수량과 배정수량을 별도 열에 표시한다. [신청·취소 캡처, PDF 50쪽](https://file.shinhansec.com/pop/guidebook2.pdf#page=50) · [계좌별 청약 현황 캡처, PDF 51쪽](https://file.shinhansec.com/pop/guidebook2.pdf#page=51) |
| 삼성증권 POP HTS `#4763` | 매뉴얼 색인은 상품 선택, 계좌와 금액 입력, 전자문서 교부 동의·다운로드·수령 확인, 환불계좌 입력을 안내한다. 원본 URL이 HTTP 410을 반환해 이 화면은 검색 색인의 텍스트로 확인했다. [공식 매뉴얼 1쪽, 인쇄 52쪽](https://www.samsungpop.com/download/customer/hts/21_ELS_subscription%2Ccancel.pdf#page=1) |

**적용안.** 상품과 원금 손실 가능성을 먼저 보여 준다. 고객은 진단과 위험 설명 확인을 마친 뒤 답변 묶음을 확인하고 모의 서명한다. 결과 화면에서 가입 ID로 같은 건을 다시 찾을 수 있게 한다. 공개 캡처는 게시 시점의 화면이다. 현재 로그인 후의 화면은 확인하지 못했다.

**접수와 가입 확정.** KB증권은 숙려대상 안내에서 배정일에 고객의 확정 의사를 확인하면 가입을 완료하고, 확정 의사를 확인하지 못하면 청약을 자동 취소한다고 설명한다. 상품 상세에서는 청약내역 조회와 배정·발행취소·환불 안내를 구분한다. MVP 화면의 가입 확정은 시연 원장의 상태다. 실제 청약 배정과 발행은 MVP 범위 밖이다. [숙려대상 고객안내](https://www.kbsec.com/go.able?linkcd=s01020101P600) · [제4469호 상품 상세](https://www.kbsec.com/go.able?gds_cd=KR6KB0008GK4&linkcd=s010201010000&pageGb=R&sbs_cd=D4469)

## 고객이 보는 원장 진행

- **Uniswap 웹 앱.** 공식 캡처의 검토 창은 서명 완료와 거래 대기를 같은 화면의 서로 다른 행에 표시한다. 거래가 성공하면 요약과 탐색기 링크를 표시한다. [공식 가이드 11·12단계](https://support.uniswap.org/hc/en-us/articles/8370549680909-How-to-swap-tokens-with-the-Uniswap-web-app) · [대기 캡처](https://support.uniswap.org/hc/article_attachments/24477182549261) · [완료 캡처](https://support.uniswap.org/hc/article_attachments/24477152017549)
- **Blockscout.** 실제 Ethereum 거래의 Details 탭에서 해시, 실행 상태, 블록 번호, 시각, 호출한 계약을 확인했다. 실패 거래도 블록에 포함돼 같은 식별 정보를 표시할 수 있다. [성공 거래](https://eth.blockscout.com/tx/0xb24bd8d0be8591e50fc48c45f76c5aefce9179f3b70115831a20cd96de625d0b) · [실패 거래](https://eth.blockscout.com/tx/0x171512e0524d4a5ce05917625ac0412f651adbbb91eb095c18bb06980a7170c5)

**적용안.** 가입 ID는 전 단계에 유지한다. `답변 등록 → 증명 생성 → 확정 거래 제출 → 원장 확인`을 보여 준다. 증명 생성은 서버에서 수행한다. 확정 거래 해시는 제출 후 표시한다. 영수증을 기다리는 동안에는 대기 상태를 보여 준다. 성공 영수증과 해당 가입 건의 원장 확정 상태를 함께 확인한 뒤 `가입 확정`을 표시한다. 블록 포함과 네트워크 최종성도 별도 개념이다. [Ethereum 거래 영수증](https://ethereum.org/developers/docs/apis/json-rpc/#eth-gettransactionreceipt) · [Ethereum 거래 수명 주기](https://ethereum.org/developers/docs/transactions/#transaction-lifecycle)

## 감독기관이 보는 원장 근거

- **TradeTrust.** 싱가포르 IMDA의 무역 문서 검증 서비스다. 공식 갤러리에서 `Electronic Bill of Lading (eBL) → Operative`를 열었다. 결과 화면은 검증 네트워크와 발행 확인, 발행자 식별, 문서 무결성을 각각 보여 준다. NFT 레지스트리 탐색기 링크도 제공한다. 배서 이력에는 행위·일자, 소유자, 보유자, 비고 열이 있다. 확인 당시 이력 조회는 네트워크 오류로 행을 불러오지 못했다. [IMDA 서비스 소개](https://www.imda.gov.sg/how-we-can-help/digital-utilities/tradetrust) · [공식 샘플 갤러리](https://gallery.tradetrust.io/) · [검증 항목 공식 문서](https://documentation.tradetrust.io/docs/tutorial/verifier/)
- **Blockscout와 Etherscan.** Blockscout의 실제 거래 Logs 탭은 이벤트를 발행한 계약 주소, 해석한 이벤트 이름과 인수, 원문 Topics와 Data를 함께 보여 준다. Etherscan 공식 문서의 Logs 화면도 같은 방식으로 근거를 확인할 수 있다. [Blockscout 로그](https://eth.blockscout.com/tx/0xb24bd8d0be8591e50fc48c45f76c5aefce9179f3b70115831a20cd96de625d0b?tab=logs) · [Etherscan 이벤트 로그 가이드](https://info.etherscan.com/what-is-event-logs/)

**적용안.** 같은 가입 ID로 판매사 API와 별도로 원장 RPC를 읽는다. 가입 상태, 적용 규칙 버전, 확정 거래의 증명 검증, 모의 서명 확인을 분리한다. 상세에서 네트워크, 원장 계약 주소, 거래 해시와 실행 상태, 블록·시각, 확정 이벤트를 보여 준다. 원장에 가입 건이 없을 때와 조회 자체가 실패했을 때를 구분한다. [기말 MVP 설계](els-zkp-mvp-prd.md)

**검증 범위.** 영수증의 성공은 최상위 호출이 성공했다는 뜻이다. 가입 확정은 지정한 계약의 상태와 해당 가입 ID의 이벤트에서 확인한다. 거래가 되돌려지면 그 실행의 상태 변경과 이벤트가 사라진다. 실패 해시는 제출 시도를 가리킬 수 있다. 서명 누락 등 실패 원인은 별도 오류 근거가 있을 때만 표시한다. 미확정 상태만으로 실패 원인을 판단할 수 없다. [EIP-658](https://eips.ethereum.org/EIPS/eip-658) · [EIP-140](https://eips.ethereum.org/EIPS/eip-140)

**증명이 확인하는 것.** ZKP는 등록한 답변에 대해 시연 규칙 v1이 정한 조건이 성립함을 확인한다. 감독 화면은 확정 거래의 증명 통과 여부와 모의 서명 기록을 보여 준다. 실제 설명이 충분했는지, 입력이 사실인지, 판매가 법을 준수했는지는 별도 증거와 심사가 필요하다. 금융위의 ELS 검사에는 설명의무와 적합성 원칙에 대한 사실 판단이 포함됐다. [Ethereum ZKP 설명](https://ethereum.org/zero-knowledge-proofs/) · [금융위 ELS 검사 결과 조치](https://www.fsc.go.kr/no010101/88082)

## DesignMD와 shadcn/ui 적용안

금융형 대안은 Trust Blue Pay의 밝은 배경과 남색 버튼을 세 화면에 적용한다. 고객 화면에는 GovKit의 양식 규칙을 적용한다. 감독 화면은 ShieldID처럼 결과를 먼저 보여 주고, LedgerCraft처럼 근거를 표에 정리한다. 청약 순서는 위 증권사 자료를 따른다.

| 레퍼런스 | 가져올 요소 |
| --- | --- |
| Trust Blue Pay | 옅은 회색 배경 `#F5F7FA`, 흰 카드, 남색 기본 버튼 `#003087`을 사용한다. 성공·대기·실패는 색과 문구로 구분한다. 목업은 금융 대시보드다. 색과 상태 표시를 참고한다. [DesignMD](https://designmd.ai/chef/trust-blue-pay) |
| GovKit | 모바일 버튼과 선택 영역을 44px 이상으로 잡는다. 필수 항목은 글자로 표시한다. 오류 문구는 해당 문항 아래에 둔다. [DesignMD](https://designmd.ai/chef/govkit) |
| ShieldID | 검증 결과를 상단에 둔다. 확인한 조건과 근거를 그 아래에 배치한다. 감독 화면의 데이터는 공개 식별자와 검증 결과, 원장 근거로 한정한다. [DesignMD](https://designmd.ai/Hihanghohengg/design-md-shieldid) |
| LedgerCraft | 얇은 경계선과 촘촘한 행을 증빙 표에 적용한다. 블록 번호는 등폭 숫자로 오른쪽 정렬한다. 가입 ID·거래 해시·원장 주소에는 고정폭 글꼴과 복사 버튼을 쓴다. CorpScale의 표는 여러 건을 한꺼번에 처리하는 업무에 맞는다. 한 건의 증빙 상세에는 LedgerCraft의 숫자 정렬을 적용한다. [LedgerCraft](https://designmd.ai/chef/ledgercraft) · [CorpScale](https://designmd.ai/chef/corpscale) |

### 미니멀 방향

**추천은 PureForm이다.** 세 화면에 밝은 배경 `#FAFAFA`와 검은 글자 `#0A0A0A`를 쓴다. 제목 굵기와 여백으로 정보를 나눈다. 그림자 없이 구성하고 기본 버튼과 링크에만 파랑 `#2563EB`을 쓴다. 원금 손실 안내와 처리 상태는 별도 색과 문구로 표시한다. [PureForm](https://designmd.ai/chef/pureform)

고객 화면은 한 열로 구성하고 화면마다 기본 버튼을 하나 둔다. 처리 시연은 Mono Deploy의 상태 행과 고정폭 식별자 표기를 밝은 화면에 적용한다. 감독 화면은 검증 결과 아래에 얇은 구분선으로 나눈 증빙 표를 둔다. [Mono Deploy](https://designmd.ai/chef/mono-deploy) · [LedgerCraft](https://designmd.ai/chef/ledgercraft)

### 화면별 컴포넌트

| 화면 | 적용 |
| --- | --- |
| 고객 청약 | 모바일 한 열로 구성한다. 상품 카드 상단의 `Alert`에 원금 손실 가능성을 표시한다. 진단과 위험 확인은 `Field`와 `Radio Group`으로 묶는다. 제출 직전 답변과 모의 계약서를 확인할 수 있게 한다. 하단의 `Button`으로 모의 서명과 제출을 진행한다. [Alert](https://ui.shadcn.com/docs/components/alert) · [Field](https://ui.shadcn.com/docs/components/field) · [Radio Group](https://ui.shadcn.com/docs/components/radio-group) · [Button](https://ui.shadcn.com/docs/components/button) |
| 처리 시연 | `Trace`에 `답변 등록 → 증명 생성 → 확정 거래 제출 → 원장 확인`을 표시한다. 증명 생성 행에는 `오프체인 · 시연 서버`를 적는다. 거래를 제출하면 해시를 보여 준다. 영수증을 기다리면 `영수증 대기`, 실패 영수증을 받으면 `거래 실행 실패`를 표시한다. 실패한 행을 펼치면 확보한 거래 해시와 실패 근거를 볼 수 있다. [Trace](https://ui.shadcn.com/docs/components/trace) · [Badge](https://ui.shadcn.com/docs/components/badge) |
| 감독기관 검증 | `Input`으로 같은 가입 ID를 조회한다. 판매사 API를 거치지 않고 지정 원장을 읽는다. `Card`에 가입 상태·규칙 버전·증명 통과·모의 서명 확인을 요약한다. `Table`에 네트워크, 원장 주소, 거래 해시·영수증, 블록 번호·시각, 해당 가입 ID의 `EnrollmentFinalized` 이벤트, 원장 상태를 표시한다. `등록 기록 없음`과 `원장 조회 실패`를 구분한다. 여러 건을 검색하거나 상태로 좁힐 때 `Data Table`의 필터를 적용한다. [Input](https://ui.shadcn.com/docs/components/input) · [Card](https://ui.shadcn.com/docs/components/card) · [Table](https://ui.shadcn.com/docs/components/table) · [Data Table](https://ui.shadcn.com/docs/components/data-table) |

공통 색은 shadcn/ui의 `--background`, `--card`, `--primary`에 연결한다. 위험 고지, 처리 대기, 거래 실패, 가입 확정에는 상태 이름을 함께 적는다. 가입 확정 표시는 성공 영수증과 같은 가입 ID의 확정 이벤트, 원장 상태가 일치할 때 사용한다. [shadcn/ui 테마](https://ui.shadcn.com/docs/theming) · [기말 MVP 설계](els-zkp-mvp-prd.md)

## oh-my-design에서 찾은 화면 레퍼런스

PureForm의 밝은 미니멀 테마에 아래 제품의 화면 패턴을 적용한다. oh-my-design은 공개 화면과 공식 문서를 바탕으로 디자인을 재구성한 아카이브다. 실제 청약 단계는 위 증권사 자료를 따른다. [저장소](https://github.com/kwakseongjae/oh-my-design)

| 화면 | 적용 |
| --- | --- |
| 고객 청약 | Toss의 모바일 양식을 참고한다. 진단 문항은 한 열로 배치한다. 동의 항목에 필수 여부를 적고, 다음 행동은 하단에 둔다. 상품 요약의 간결한 제목과 보조 설명은 Toss Securities를 참고한다. 아카이브가 확인한 증권사 화면은 공개 WTS와 상품 소개다. [Toss](https://oh-my-design.kr/design-systems/toss) · [공식 TDS 동의](https://tossmini-docs.toss.im/tds-mobile/components/Agreement/v4/) · [Toss Securities](https://oh-my-design.kr/design-systems/toss-securities) |
| 처리 시연 | Vercel처럼 단계 이름과 상태를 한 행에 둔다. 거래 해시는 고정폭 글꼴로 표시한다. `Trace` 행을 펼치면 영수증과 확인 근거를 볼 수 있다. 거래 상태의 의미는 위 Blockscout 사례를 따른다. [Vercel](https://oh-my-design.kr/design-systems/vercel) · [공식 Geist 배지](https://vercel.com/geist/badge) · [공식 Runtime Logs](https://vercel.com/docs/logs/runtime) |
| 감독기관 검증 | KRDS의 입력 레이블과 표 구조를 참고한다. 조회 입력에 `가입 ID`를 표시한다. 결과 요약 아래에 영수증·확정 이벤트·원장 상태를 읽기 전용 표로 배치한다. [KRDS](https://oh-my-design.kr/design-systems/krds) · [공식 컴포넌트 가이드](https://v04.krds.go.kr/guide/index.html) · [공식 텍스트 입력](https://www.krds.go.kr/html/site/component/component_09_03.html) |
