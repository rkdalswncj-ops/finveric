---
version: alpha
name: FINVERIC · 핀베릭
description: 진입 화면, 판매사 콘솔, 판매 채널 시연, 처리 로그, 감독기관 대조 화면의 디자인 기준
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
typography:
  page-title:
    fontFamily: "Noto Sans KR, sans-serif"
    fontSize: 1.75rem
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Noto Sans KR, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  detail:
    fontFamily: "Noto Sans KR, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  identifier:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
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

서비스명은 **핀베릭(FINVERIC)**이다. 화면의 브랜드 영역에는 `FINVERIC`을 표시한다. 설명에는 `펀드 판매절차 공동 검증 플랫폼`을 쓴다.

FINVERIC 화면의 사용자는 기관이다. 판매사의 소비자보호 담당은 client 페이지(판매사 콘솔)에서 진단 기준, 상품, 판매 건, 위험 신호를 본다. 감독기관은 auditor 페이지에서 같은 판매 ID로 원본과 처리 근거를 대조한다. 고객 화면은 client의 판매 채널 시연에만 있다. 이 화면은 증권사 앱에서 고객이 상품을 확인하고 가입하고, 받은 증명서로 기록을 확인하는 모습을 보여 준다. 화면의 업무 규칙은 [PRD](docs/prd.md)를 따른다.

화면은 밝은 배경과 짙은 글자를 공유한다. 고객의 질문과 확인 절차는 Toss를 참고한다. 상품 정보는 삼성자산운용을 참고한다. 판매사 콘솔은 Linear, 처리 로그는 Stripe, 감독기관 대조와 가입 기록 확인은 TradeTrust의 패턴을 참고한다.

### 레퍼런스 고정

기본 출처는 oh-my-design 커밋 `888d0358a4984671dfe103a22ce32a34284d77b2`의 Toss 레퍼런스다. 아카이브는 공개 자료를 바탕으로 디자인을 재구성했다. 적용 규칙은 이 파일을 기준으로 한다. 원본은 커밋으로 고정한 업스트림 링크로 확인한다. oh-my-design은 MIT 라이선스다. [업스트림 원본](https://github.com/kwakseongjae/oh-my-design/blob/888d0358a4984671dfe103a22ce32a34284d77b2/web/references/toss/DESIGN.md)

보조 레퍼런스도 같은 커밋을 쓴다. 상품 요약은 [토스증권](https://github.com/kwakseongjae/oh-my-design/blob/888d0358a4984671dfe103a22ce32a34284d77b2/web/references/toss-securities/DESIGN.md)을 참고한다. 처리 정보는 [Vercel Geist](https://github.com/kwakseongjae/oh-my-design/blob/888d0358a4984671dfe103a22ce32a34284d77b2/web/references/vercel/DESIGN.md)를 참고한다. 감독기관 조회는 [KRDS](https://github.com/kwakseongjae/oh-my-design/blob/888d0358a4984671dfe103a22ce32a34284d77b2/web/references/krds/DESIGN.md)를 참고한다.

## Colors

YAML의 색상을 [shadcn/ui 테마 변수](https://ui.shadcn.com/docs/theming)에 연결한다. 기본 동작과 링크에 파랑을 쓴다. 성공·주의·실패에는 해당 색과 상태 이름을 함께 쓴다. 대기는 중립 배경과 상태 이름으로 표시한다. 얇은 구분선에는 `border`를 쓴다. 입력 테두리에는 `input`을 쓰고 키보드 포커스에는 `ring`을 쓴다.

## Typography

고객 화면 제목은 질문이나 현재 상태를 한 문장으로 쓴다. 본문과 표는 왼쪽에 정렬한다. 해시와 원장 주소에는 `identifier`를 쓴다. 블록 번호는 등폭 숫자로 정렬한다.

## Layout

- 웹은 페이지 세 개다. 진입 화면(`/`)은 사이드 메뉴 없이 역할 카드 2개(판매사 콘솔, 감독기관), 시연 순서, 연결된 원장 상태를 보여 준다. [결정 기록](docs/adr/0006-seller-console-and-single-web-app.md)
- client의 메뉴는 두 묶음이다. **판매사 업무**는 대시보드, 진단 기준, 상품 관리, 판매·검토, 위험 신호, 온체인 처리다. 첫 화면은 대시보드다. **판매 채널 시연**은 펀드 찾기, 가입하기, 내 가입 기록, 가입 기록 확인이다. 판매 채널 시연에는 "증권사 앱에서 고객이 보는 화면"이라는 설명을 붙인다.
- auditor의 메뉴는 지금 분쟁 조회 하나다. 원장 v5 단계에서 대시보드, 기준 감사, 상품 감사, 위험 신호, 보고서를 더한다. 좁은 화면에서는 같은 메뉴를 상단에 배치한다.
- 모든 페이지는 같은 토큰과 컴포넌트를 쓴다. 공통 요소는 `packages/ui`에 둔다.
- 상품 탐색은 카드, 비교 목록, 상품 집중 배치를 시안에서 비교한다. 상품 카드에는 운용사·판매사·위험·비용·전략을 표시한다. 세 가상 상품 모두 상세 화면에서 가입을 시작할 수 있다.
- 고객 가입은 최대 480px의 한 열로 구성한다. 모바일에서는 좌우 여백을 24px로 둔다. 상품 설명 상단에 `원금 손실 가능`을 표시한다. 진단은 한 화면에 한 문항을 둔다. 고객이 최종 확인하면 가입 거래를 한 건 제출한다. 고객이 가입을 중단하면 임시 기록을 폐기한다.
- 대시보드는 요약 수치 4개(진행 중인 가입, 가입 확정, 관리자 승인 대기, 위험 신호), 최근 판매 건, 적용 기준을 보여 준다. 판매·검토는 상태 요약, 판매 건 목록, 선택한 건의 타임라인을 보여 준다. 처리 시연은 같은 판매 ID의 로그 목록과 상세 응답을 나란히 둔다. 분쟁 조회는 검증할 기록을 고르는 영역과 항목별 결과를 보여 준다. 좁은 화면에서는 영역을 위아래로 배치한다.
- 가입 기록 확인은 최대 600px의 한 열이다. 결과는 `일치`, `불일치`, `기록 없음` 세 상태만 쓴다. 블록체인 용어를 숨기고, 블록 번호와 해시는 "기술 정보 보기"에 접어 둔다. 불일치는 주황색 경고 색과 아이콘, 글자로 함께 표시한다.

## Elevation & Depth

여백과 얇은 구분선으로 영역을 나눈다. 상태 표시는 글자와 옅은 배경을 쓴다.

## Shapes

일반 입력은 `control` 반경을 쓴다. 고객 화면 하단의 주요 버튼은 `action` 반경을 쓴다. 모바일 선택 영역의 높이는 최소 44px로 잡는다.

## Components

| 화면 | shadcn/ui 구성과 표시 규칙 |
| --- | --- |
| 펀드 탐색 | `Sidebar`, `Card`, `Input`, `Button`, `Badge` 패턴으로 상품과 탐색 동작을 구분한다. 실제 구현에서는 사용자에게 운용사와 판매사의 역할을 각각 표시한다. |
| 고객 가입 | 위험 안내는 `Alert`를 쓴다. 진단은 `Field`와 `RadioGroup`을 쓴다. 상품 설명과 추가 위험 확인은 각각 `Checkbox`를 쓴다. 최종 동작은 `확인하고 가입하기`로 표시한다. |
| 처리 시연 | `Trace`에 시각, 출처, 작업 이름, 결과를 표시한다. 기록을 받으면 시간순으로 한 줄씩 추가한다. 증권사 API, 원장 상태, 거래 영수증, 컨트랙트 이벤트를 구분한다. 거래 해시는 제출 후 표시한다. 영수증을 받으면 펼쳐서 JSON을 확인할 수 있다. 대기와 거래 실행 실패는 서로 다른 상태로 표시한다. |
| 분쟁 조회 | 가입 이력에서 한 건을 선택한다. 파일로 검증할 때는 판매 ID를 입력하거나 보관한 파일을 선택한다. 원본 무결성, 상품·문서 버전, 진단 증명, 필수 기록, 판매 절차 상태를 항목별로 표시한다. 아래 `Table`에는 지정한 네트워크·컨트랙트와 거래 근거를 표시한다. 원본 일치와 가입 조건 검증 완료를 구분한다. |
| 위험 신호 | 신호 종류를 `Badge`(주의 색)와 이름으로 함께 표시한다. 종류별 필터 칩과 판매 건 목록을 둔다. 판매 건을 열면 판매·검토 화면에서 회차 이력을 본다. |
| 가입 기록 확인 | 증명서 번호 `Input`, 파일 선택 두 개, `확인하기` 버튼을 한 카드에 둔다. 결과 카드는 상태 `Badge`, 제목 한 문장, 다음 행동 안내를 보여 준다. |

## Do's and Don'ts

- 고객 문구는 해요체로 쓴다. 결과 제목에는 `가입 요청을 받았어요`, `가입 절차를 확인하고 있어요`, `모의 가입 절차를 완료했어요`처럼 현재 상태를 적는다.
- 실제 앱의 가입 조건 검증 완료는 지정한 원장에서 성공 영수증, 같은 판매 ID의 이벤트, 상태를 대조한 뒤 표시한다. 매입 결과는 별도 상태로 표시한다. 단순 파일 지문 일치와 가입 조건 검증 완료를 구분한다.
- 디자인 규칙을 변경할 때 이 파일과 해당 UI를 함께 수정한다. 레퍼런스 버전을 바꿀 때는 커밋 링크를 갱신한다.
