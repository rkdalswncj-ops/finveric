---
version: alpha
name: FINVERIC · 핀베릭
description: 진입 화면, 판매사 콘솔, 증권사 앱 예시, 처리 로그, 감독기관 대조 화면의 디자인 기준
colors:
  background: "#FAFAFA"
  card: "#FFFFFF"
  foreground: "#191F28"
  muted-foreground: "#4E5968"
  muted: "#F2F4F6"
  border: "#E5E8EB"
  input: "#6B7684"
  primary: "#2563EB"
  primary-foreground: "#FFFFFF"
  primary-hover: "#1D4ED8"
  ring: "#1D4ED8"
  success: "#116149"
  success-surface: "#EAF6EF"
  warning: "#7A4900"
  warning-surface: "#FFF3D7"
  destructive: "#A32535"
  destructive-surface: "#FFF1F1"
  primary-surface: "#EDF3FF"
  product-fund: "#31785B"
  product-fund-surface: "#ECF5F1"
  product-elb: "#7566AD"
  product-elb-surface: "#F0EFFA"
  selection: "#DCE8FF"
  selection-foreground: "#173E91"
  scrollbar: "#B0B8C1"
typography:
  display:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.02em
  page-title:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 1.75rem
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.02em
  title-lg:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.02em
  title:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.01em
  heading:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 1.125rem
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.01em
  body-lg:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.6
  detail:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.6
  identifier:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.6
rounded:
  control: 8px
  action: 16px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  customer-primary-button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.action}"
    height: 56px
  customer-primary-button-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-foreground}"
  console-input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: 44px
  risk-alert:
    backgroundColor: "{colors.warning-surface}"
    textColor: "{colors.warning}"
  status-pending:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
  status-confirmed:
    backgroundColor: "{colors.success-surface}"
    textColor: "{colors.success}"
  status-failed:
    backgroundColor: "{colors.destructive-surface}"
    textColor: "{colors.destructive}"
---

## Overview

서비스명은 **핀베릭(FINVERIC)**이다. 화면의 브랜드 영역에는 `FINVERIC`을 표시한다. 설명에는 `판매 기록 검증`을 쓴다.

FINVERIC 화면의 사용자는 기관이다. 판매사의 소비자보호 담당은 client 페이지(판매사 콘솔)에서 진단 기준, 상품, 판매 건, 위험 신호를 본다. 감독기관은 auditor 페이지에서 같은 판매 ID로 원본과 처리 근거를 대조한다. 고객 화면은 client의 판매 채널에만 있다. 이 화면은 증권사 앱에서 고객이 상품을 확인하고 가입하고, 받은 증명서로 기록을 확인하는 화면을 재현한다. 화면의 업무 규칙은 [PRD](docs/prd.md)를 따른다.

화면은 밝은 배경과 짙은 글자를 공유한다. 고객의 질문과 확인 절차는 Toss를 참고한다. 상품 정보는 삼성자산운용을 참고한다. 판매사 콘솔은 Linear, 처리 로그는 Stripe, 감독기관 대조와 가입 기록 확인은 TradeTrust의 패턴을 참고한다.

### 레퍼런스 고정

기본 출처는 oh-my-design 커밋 `888d0358a4984671dfe103a22ce32a34284d77b2`의 Toss 레퍼런스다. 아카이브는 공개 자료를 바탕으로 디자인을 재구성했다. 적용 규칙은 이 파일을 기준으로 한다. 원본은 커밋으로 고정한 업스트림 링크로 확인한다. oh-my-design은 MIT 라이선스다. [업스트림 원본](https://github.com/kwakseongjae/oh-my-design/blob/888d0358a4984671dfe103a22ce32a34284d77b2/web/references/toss/DESIGN.md)

보조 레퍼런스도 같은 커밋을 쓴다. 상품 요약은 [토스증권](https://github.com/kwakseongjae/oh-my-design/blob/888d0358a4984671dfe103a22ce32a34284d77b2/web/references/toss-securities/DESIGN.md)을 참고한다. 처리 정보는 [Vercel Geist](https://github.com/kwakseongjae/oh-my-design/blob/888d0358a4984671dfe103a22ce32a34284d77b2/web/references/vercel/DESIGN.md)를 참고한다. 감독기관 조회는 [KRDS](https://github.com/kwakseongjae/oh-my-design/blob/888d0358a4984671dfe103a22ce32a34284d77b2/web/references/krds/DESIGN.md)를 참고한다.

## Colors

YAML의 색상을 [shadcn/ui 테마 변수](https://ui.shadcn.com/docs/theming)에 연결한다. 기본 동작과 링크에 파랑을 쓴다. 성공·주의·실패에는 해당 색과 상태 이름을 함께 쓴다. 대기는 중립 배경과 상태 이름으로 표시한다. 얇은 구분선에는 `border`를 쓴다. 입력 테두리에는 `input`을 쓰고 키보드 포커스에는 `ring`을 쓴다.

`primary-surface`는 선택한 행, 현재 메뉴, 파란 배지, 처리 중·대기 상자의 바탕이다. `product-fund`, `product-elb`와 각 `-surface`는 증권사 앱 예시의 상품 유형 기호에만 쓴다. ELS 기호는 `primary`를 쓴다. `selection`은 끌어서 고른 글자, `scrollbar`는 스크롤 막대에 쓴다. 색 값은 `packages/ui/src/theme.css`의 `:root`에만 둔다.

## Typography

고객 화면 제목은 질문이나 현재 상태를 한 문장으로 쓴다. 본문과 표는 왼쪽에 정렬한다. 해시와 원장 주소에는 `identifier`를 쓴다. 블록 번호는 등폭 숫자로 정렬한다.

글자 크기는 YAML의 10단계만 쓴다. CSS 변수는 `packages/ui/src/theme.css`의 `--type-*`이고 단위는 rem이다. 새 크기를 만들지 않는다. 최소 크기는 12px(`caption`)다.

- 제목(h1–h3) 줄 높이는 1.3이다. 24px 이상의 큰 수치(요약 수치, 남은 시간)는 1.2다. 본문은 1.6이다.
- 제목 자간은 24px 이상에서 -0.02em이고, 그보다 작으면 -0.01em이다. 본문 자간은 0이다.
- 640px 이하에서 입력 글자는 16px다. iOS Safari가 입력할 때 화면을 확대하지 않게 한다.
- 제목은 `text-wrap: balance`, 문단은 `text-wrap: pretty`를 쓴다. 문단 폭은 72ch까지다.
- 바뀌는 수치(남은 시간, 요약 수치, 금액, 블록 번호)는 등폭 숫자(`tabular-nums`)로 쓴다. 배지와 단계 표시는 줄을 바꾸지 않는다.
- 글꼴은 시스템 한글 글꼴이다. 웹 글꼴을 내려받지 않는다. 가짜 기울임만 막는다(`font-synthesis-style: none`).
- Tailwind 이름(`--text-*`, `--font-*`, `--leading-*`, `--tracking-*`)은 변수 이름에 쓰지 않는다. `theme.css`가 tailwindcss를 가져오기 때문이다.

## Layout

- 웹은 페이지 네 개다. 진입 화면(`/`)은 사이드 메뉴 없이 역할 카드 2개(판매사 콘솔, 감독기관)와 연결된 원장 상태를 보여 준다. [결정 기록](docs/adr/0006-seller-console-and-single-web-app.md), [0007](docs/adr/0007-openapi-and-channel-sample-app.md)
- client의 메뉴는 판매사 업무만 둔다. 대시보드, 진단 기준, 상품 관리, 판매·검토, 위험 신호, 온체인 처리, API 키다. 첫 화면은 대시보드다.
- 사이드바 하단에는 다른 페이지로 가는 링크만 둔다. **처음 화면**은 같은 탭으로, **증권사 앱 예시**와 **API 문서**는 새 탭으로 연다. 새 탭 링크에는 바깥 링크 아이콘을 붙인다. 사이드바에 설명 문장을 두지 않는다.
- client와 auditor는 서로 링크하지 않는다. 사이드 메뉴의 브랜드(`FINVERIC`)와 "처음 화면" 항목이 같은 탭에서 진입 화면으로 간다.
- auditor의 메뉴는 대시보드, 분쟁 조회, 기준 감사, 상품 감사, 위험 신호, 보고서다. 첫 화면은 대시보드다. 모든 자료는 지정 RPC의 원장에서 읽는다. 좁은 화면에서는 같은 메뉴를 상단에 배치한다.
- 모든 페이지는 같은 토큰과 컴포넌트를 쓴다. 공통 요소는 `packages/ui`에 둔다.
- 사이드바는 화면 높이에 맞추고, 메뉴가 길면 사이드바 안에서 스크롤한다. 가로로 스크롤하는 표의 설명 문장은 표 위 문단(`tableNote`)에 두고, `<caption>`에는 화면 낭독기용 짧은 제목만 둔다.
- 증권사 앱 예시(`/channel/`)는 휴대폰 앱 모양이다. 넓은 화면에서도 최대 480px 한 열을 가운데에 둔다. 좌우 여백은 24px다. 맨 위 줄은 앱 밖의 표시(`FINVERIC API 연동 예시`, 네트워크 배지)다. 그 아래에 앱 머리글, 맨 아래에 탭 막대(상품, 가입, 내 가입, 기록 확인)를 둔다.
- 상품 탭은 카드 목록이다. 상품 카드에는 상품 유형, 위험등급, 발행사·운용사, 판매사, 수수료, 최대 손실을 표시한다. 고난도 상품은 이름 앞에 `고난도 금융투자상품`을 붙인다. 카드의 **가입하기**는 바로 가입을 시작하고, **자세히 보기**는 상세 화면을 연다. 상세 화면에서 판매대상 고객군을 확인한다.
- 고객 가입 순서는 진단(한 화면에 한 문항) → 결과 → 적합성 확인 → 핵심 설명 카드 5장 → 녹취 동의(대상만) → 청약 → 숙려 → 최종 확인 → 증명서다. 설명 카드의 첫 장은 부적합 고객 유형과 손실 사례다. 숙려 화면은 남은 시간과 위험·최대 손실을 다시 보여 준다. 청약 전에는 언제든 가입을 중단할 수 있고, 진단 회차는 원장에 남는다.
- 가입 단계 화면은 위에 단계 머리(이전, 단계와 진행률, 중단)를 고정한다. 단계가 바뀌면 화면 맨 위로 가고 새 단계 제목에 초점을 옮긴다. 주요 동작은 단계마다 하나이고 아래 동작 막대에 둔다. 640px 이하에서는 동작 막대를 탭 막대 바로 위에 고정한다. 보조 동작은 본문 안의 외곽선 버튼으로 둔다.
- 처리 중에는 주요 버튼 안에 진행 표시를 두고 버튼을 막는다. 버튼 아래 한 줄에 진행 중인 처리를 적는다. 오류는 머리글 아래 떠 있는 알림으로 보여 주고 본문을 밀지 않는다.
- 중단, 청약 철회, 다른 상품의 청약 전 가입을 버리는 시작은 가운데 확인 창으로 묻는다. 안전한 선택을 주요 버튼으로 두고 초점을 준다. 탭 이동은 묻지 않고 진행 단계를 그대로 둔다.
- 관리자 승인을 기다리는 청약 단계는 파란 안내 상자와 진행 표시를 보여 준다. 승인되면 새로 고침 없이 **청약하기**가 열린다. 고객이 직접 눌러야 청약한다.
- 판매사 대시보드는 요약 수치 4개(진행 중·숙려 중 청약, 가입 확정, 관리자 승인 대기, 위험 신호), 최근 판매 건, 적용 기준을 보여 준다. 감독기관 대시보드는 상태별 판매 건 수, 진단 회차, 고객 가명 ID 수, 상품·위험등급별 분포, 재진단·부적합 비율, 최근 원장 이벤트를 보여 준다. 판매·검토는 상태 요약, 판매 건 목록, 선택한 건의 타임라인을 보여 준다. 처리 시연은 같은 판매 ID의 로그 목록과 상세 응답을 나란히 둔다. 분쟁 조회는 판매 ID나 고객 가명 ID로 찾는 영역과 항목별 결과를 보여 준다. 원장만 대조한 결과와 제출 자료를 넣은 결과를 따로 표시한다. 좁은 화면에서는 영역을 위아래로 배치한다.
- 기록 확인 탭의 결과는 `일치`, `불일치`, `기록 없음` 세 상태만 쓴다. 블록체인 용어를 숨기고, 블록 번호와 해시는 "기술 정보 보기"에 접어 둔다. 불일치는 주황색 경고 색과 아이콘, 글자로 함께 표시한다.

## Elevation & Depth

여백과 얇은 구분선으로 영역을 나눈다. 상태 표시는 글자와 옅은 배경을 쓴다.

## Shapes

일반 입력은 `control` 반경을 쓴다. 고객 화면 하단의 주요 버튼은 `action` 반경을 쓴다. 모바일 선택 영역의 높이는 최소 44px로 잡는다.

## Components

| 화면 | shadcn/ui 구성과 표시 규칙 |
| --- | --- |
| 상품 목록 | `Card`, `Button`, `Badge` 패턴으로 상품과 탐색 동작을 구분한다. 발행사·운용사와 판매사의 역할을 각각 표시한다. |
| 고객 가입 | 위험 안내와 부적합 안내는 `Alert`를 쓴다. 진단은 `Field`와 `RadioGroup`을 쓴다. 추가 위험 확인과 녹취 동의는 각각 `Checkbox`를 쓴다. 단계 머리는 `StepHeader`, 주요 버튼은 `PrimaryAction`, 아래 동작 막대는 `ActionBar`, 확인 창은 `ConfirmDialog`다(`apps/web/src/channel/flow.tsx`). 청약과 최종 확인은 서로 다른 단계의 주요 버튼이다. 숙려 중에는 남은 시간을 표시하고, 남은 시간이 끝날 때까지 최종 확인 버튼을 막는다. |
| 진단 기준 | 버전 목록, 선택한 버전의 문항·선택지(점수, 추출 제한, 고령 표시), 점수 구간, 등급별 권유 가능 위험등급을 표로 보여 준다. 편집기는 오류를 바로 표시하고, 미리보기에서 답을 골라 투자성향과 권유 가능 위험등급을 확인한다. |
| 기준·상품 감사 | 버전마다 원장 해시와 원문으로 다시 계산한 해시를 나란히 둔다. 일치 여부를 상태 `Badge`와 글자로 표시한다. 버전 사이의 차이는 추가·삭제·변경 목록으로 보여 준다. |
| 처리 시연 | `Trace`에 시각, 출처, 작업 이름, 결과를 표시한다. 기록을 받으면 시간순으로 한 줄씩 추가한다. 증권사 API, 원장 상태, 거래 영수증, 컨트랙트 이벤트를 구분한다. 거래 해시는 제출 후 표시한다. 영수증을 받으면 펼쳐서 JSON을 확인할 수 있다. 대기와 거래 실행 실패는 서로 다른 상태로 표시한다. |
| 분쟁 조회 | 원장의 판매 건에서 고르거나 판매 ID를 입력한다. 대조 자료는 원장만, 판매사 제출 자료, 파일 중에서 고른다. 판매 기록, 상품 설명서 버전, 진단 기준 원문, 진단 회차, 원본 답변 대조, 적합성·필수 확인, 숙려·최종 확인, 증명서 대조를 항목별로 표시한다. 거래 해시와 블록은 접어 둔다. |
| 위험 신호 | 신호 종류를 `Badge`(주의 색)와 이름으로 함께 표시한다. 종류별 필터 칩과 판매 건 목록을 둔다. 판매 건을 열면 판매·검토 화면에서 회차 이력을 본다. |
| 기록 확인 | 증명서 번호 `Input`, 파일 선택 두 개, `확인하기` 버튼을 한 카드에 둔다. 결과 카드는 상태 `Badge`, 제목 한 문장, 다음 행동 안내를 보여 준다. |

## Do's and Don'ts

- 고객 문구는 해요체로 쓴다. 결과 제목에는 `가입 요청을 받았어요`, `마지막으로 가입 의사를 확인해요`, `가입이 확정됐어요`처럼 현재 상태를 적는다.
- 가입 확정은 지정한 원장에서 성공 영수증, 같은 판매 ID의 이벤트, 상태를 대조한 뒤 표시한다. 결제 기록은 별도 상태로 표시한다. 단순 파일 지문 일치와 가입 조건 검증 완료를 구분한다.
- 실제 서비스 화면으로 만든다. 화면 문구에 `시연`, `모의`, `테스트용`을 쓰지 않는다. 발표용 조작 버튼을 두지 않는다. 네트워크 배지(`Anvil 테스트 원장`, `Sepolia 테스트넷`)는 연결한 환경을 알리므로 그대로 쓴다. 원장에 등록한 기준·상품 이름은 바꾸지 않는다. 바꾸면 해시가 바뀐다.
- 디자인 규칙을 변경할 때 이 파일과 해당 UI를 함께 수정한다. 레퍼런스 버전을 바꿀 때는 커밋 링크를 갱신한다.
