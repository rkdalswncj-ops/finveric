# 금융투자상품 판매절차 검증 시장 조사

2026-11-06 기준 · 한국 시간 · 금융사, 공급사, 감독기관의 공개 자료 비교

금융사에 판매 전 적합성 판정과 감사기록을 제공하는 서비스가 이미 있다. 금융기관이 청약 처리에 분산원장을 쓰고, 스마트컨트랙트로 투자자 자격을 확인한 실제 사례도 있다. 조사 범위에서 ELS 등 소매 구조화상품의 적합성 진단, 설명 확인, 동의를 같은 판매 건에 연결하고, 적용 규칙과 충족 여부를 감독기관이 판매사 시스템과 별도로 검증하는 상용 서비스는 확인하지 못했다. [MVP PRD](prd.md) · [FinIQ](https://www.finiq.com.sg/FinIQ_UseCase.html) · [iCapital](https://icapital.com/newsroom/press-releases/icapital-deploys-distributed-ledger-technology-to-streamline-alternative-investment-onboarding-and-pre-trade-processing/) · [Tokeny](https://tokeny.com/wp-content/uploads/2025/04/ABN-AMRO-ERC3643-Use-Case.pdf)

## 국내에서 확인한 대안

| 사례 | 공개 자료로 확인한 내용 | 이 프로젝트와 비교 |
| --- | --- | --- |
| 젠티 AIVS | 판매 상담 녹취를 텍스트로 바꾸고, 필수 고지 항목과 불완전판매 의심 문장을 분석한다. 검토 화면과 대시보드를 제공한다. 젠티는 2025년 11월 신영증권 도입을 공개했다. [제품](https://jenti.ai/products/aivs) · [공급사 도입 공개](https://jenti.ai/) | 같은 고객과 내부 점검 업무를 대상으로 하는 국내 B2B 사례다. 공개 제품 설명의 검증 대상은 상담 내용이다. 외부에서 당시 판정 규칙과 증빙을 직접 대조하는 기능은 확인하지 못했다. |
| KB증권 AMS | KB금융그룹은 2022년 보고서에서 KB증권의 불완전판매 사전 예방시스템 AMS 운영을 공개했다. [KB금융그룹 보고서](https://m.kbfg.com/common/jsp/fileDownUtil.jsp?filepath=%2Fkor%2Fabout%2Fsustainability%2F__attachFile%2FKB%EA%B8%88%EC%9C%B5%EA%B7%B8%EB%A3%B9_2022_%EC%A7%80%EC%86%8D%EA%B0%80%EB%8A%A5%EA%B2%BD%EC%98%81%EB%B3%B4%EA%B3%A0%EC%84%9C_%EA%B5%AD%EB%AC%B8.pdf) | 내부에서 이미 쓰는 시스템도 구매 결정의 비교 대상이다. 보고서는 외부 제품 판매나 감독기관의 원장 직접 조회를 확인해 주지 않는다. |
| KT Paperless | 전자계약에서 타임스탬프와 인증서 정보로 문서의 진본성·변경 여부를 확인한다. 공인전자문서센터 보관 및 증명서 발급도 제공한다. [전자계약](https://paperless.kt.com/staticPage/creation.htm) · [공인전자문서센터](https://paperless.kt.com/staticPage/docuDeposit.htm) | 설명서나 계약서의 무결성은 기존 기능과 겹친다. 당시 적용 규칙에 따라 청약 조건을 평가했다는 증명과, 이 증명을 같은 가입 건에 연결하는 기능을 따로 검증해야 한다. |

## 해외 상용 서비스

| 사례 | 공개 기능과 운영 근거 | 프로젝트와 비교 |
| --- | --- | --- |
| **FinIQ / Mashreq** | FinIQ는 적합성 검사, 서류 생성, 기관이 설정하는 승인 절차와 감사기록을 한 화면에 제공한다. 공급사는 Mashreq가 FinIQ를 투자상품 관리의 핵심 시스템으로 도입했고, 적합성 검사와 주문 전후 문서 생성을 포함한다고 밝혔다. 은행도 고객에게 자사 주식 거래에 FinIQ를 사용한다고 안내한다. [FinIQ 기능 발표](https://www.finiq.com.sg/FinIQ_News.html) · [FinIQ 도입 사례](https://www.finiq.com.sg/FinIQ_UseCase.html) · [Mashreq 고객 안내](https://www.mashreq.com/en/uae/gold/wealth-solutions/investment/equities/) | 구조화상품 판매에 가까운 업무 경쟁 사례다. 은행의 자체 안내로 확인한 운영 범위는 주식 주문이다. |
| **Four Eyes Financial** | 펀드 판매사를 대상으로 적합성 판단, 비교한 상품, 상담 담당자 확인, 상품 안내서 전달을 한 건의 감사 이력에 남긴다고 안내한다. [펀드 판매사 제품](https://foureyes.financial/mutual-fund-dealers/) | 한 판매 건에 여러 단계의 증빙을 묶는 기능이 이미 공개돼 있다. 제품 설명으로 기능 범위를 확인했다. |
| **Muinmos / Sheer Markets** | 상품 제안이나 거래 전에 고객의 경험, 재정 상태, 목표, 위험 감수 수준을 평가한다. 관할·상품·고객별 규칙으로 판정하고 감사기록을 남긴다. 공급사의 2022년 발표에 따르면 Sheer Markets는 적합성·적정성 검사 모듈을 포함한 제품을 선택했다. Sheer Markets 임원은 API를 연동했다고 밝혔다. [Muinmos 기능](https://muinmos.com/suitability-appropriateness-across-jurisdictions/) · [도입 발표](https://muinmos.com/sheer-markets-selects-muinmos-for-fast-onboarding-regulatory-compliance/) | 고객 등록과 판매 전 규칙 적용이 겹친다. 공개 기능의 검토 주체는 금융사 준법팀이다. |
| **Recordsure / Attivo** | Attivo는 진행 중인 투자자문 기록을 검사하고 추가 검토가 필요한 건을 담당자에게 보낸다. 공급사 계열사 TCC는 첫 6개월 동안 1,000건 이상을 검토했고 건당 검토 비용이 평균 40% 줄었다고 발표했다. [TCC 도입 발표](https://tcc.group/insights/press-releases/attivo-deploys-recordsures-ai-technology-to-evidence-its-ongoing-advice-compliance-and-cut-file-review-costs/) | 기업이 적합성 검사 비용을 줄이기 위해 외부 서비스를 도입한 사례다. 공개 성과는 기존 자문 기록을 검토한 결과다. |

아일랜드 중앙은행도 복합상품 적정성 검사에서 자동 설문, 상품별 지식·경험 기준, 고객 이해도를 확인하는 문항을 관찰했다. 형식적 체크리스트에 의존한 사례에서는 수집한 정보와 판정 결과를 연결하는 근거가 부족했다. [아일랜드 중앙은행 검사 결과](https://www.centralbank.ie/docs/default-source/regulation/consumer-protection/compliance-monitoring/themed-inspections/stockbroking-investment-firms/thematic-inspection-of-appropriateness-under-mifid-ii.pdf)

## 기관 간 원장과 외부 검증

| 사례 | 공개 기능과 운영 근거 | 프로젝트와 비교 |
| --- | --- | --- |
| **iCapital / Morgan Stanley Wealth Management · 배포** | iCapital은 2025년 11월 Morgan Stanley Wealth Management의 대체투자 펀드 청약에 분산원장을 배포했다고 발표했다. 판매사, 펀드 운용사, 사무관리사가 청약 서류를 검토하고 보완하는 작업을 자동화한다. iCapital은 2025년 3월 같은 원장에 펀드 100개 이상을 등록했다고 별도로 발표했다. [Morgan Stanley 적용 발표](https://icapital.com/newsroom/press-releases/icapital-deploys-distributed-ledger-technology-to-streamline-alternative-investment-onboarding-and-pre-trade-processing/) · [펀드 등록 발표](https://icapital.com/newsroom/announcements/icapital-achieves-milestone-with-100-funds-on-its-distributed-ledger/) | 투자상품 청약 기록을 기관 간에 공유한다는 점에서 가깝다. 공개된 연동 범위는 청약 서류 검토와 보완이다. |
| **Tokeny / ABN AMRO · 실제 발행** | Vesteda는 2023년 디지털 녹색채권으로 기관투자자 DekaBank에서 500만 유로를 조달했다. ABN AMRO는 고객확인 원본을 원장 밖에 두고 확인 결과에 서명한다. ERC-3643 스마트컨트랙트는 토큰 이전 때마다 확인 결과가 유효한지 검사한다. [Vesteda 발행 발표](https://news.vesteda.com/vesteda-first-real-estate-investor-to-use-public-blockchain-in-green-financing/) · [Tokeny 구현 사례](https://tokeny.com/wp-content/uploads/2025/04/ABN-AMRO-ERC3643-Use-Case.pdf) | 원본을 공개하지 않고 거래 조건을 검사하는 선행 사례다. 확인 대상은 은행이 발급한 고객확인 증명이다. |
| **FCA / R3 Project Maison · 시제품** | 영국 FCA와 R3, 은행 두 곳이 Corda를 사용했다. 은행이 주택담보대출 거래를 확정한 뒤 FCA의 테스트 노드가 수 초 안에 거래 보고를 받았다. [FCA 보고서 21쪽](https://www.fca.org.uk/publication/feedback/fs17-04.pdf#page=21) | 감독기관이 공유 원장으로 거래 보고를 받은 사례다. 검증 범위는 시험 환경의 거래 데이터 보고였다. |

iCapital은 Canton Network를 기반으로 이 서비스를 제공한다. 2026년 6월에는 UMB Fund Services와 청약 처리 및 펀드 관리를 연결하는 제휴를 공개했다. [iCapital 제품](https://icapital.com/distributed-ledger-technology/) · [UMB 연동 발표](https://icapital.com/newsroom/press-releases/icapital-and-umb-expand-blockchain-enabled-network-for-alternative-investments-through-distributed-ledger-technology-integration/)

## 영지식증명 사례

- **BIS Project Mandala.** 한국은행 등이 참여한 1단계 개념검증은 국경 간 지급 전에 규칙을 검사하고, 고객 원본 데이터 공개 없이 검증 가능한 암호학적 증명을 생성했다. BIS는 2단계 연구를 공개했다. 투자상품 판매나 상용 증권사 감사 제품의 사례로 보지 않는다. [BIS 프로젝트](https://www.bis.org/project/mandala) · [한국은행 최종결과 보고서](https://www.bok.or.kr/portal/bbs/B0000232/view.do?menuNo=200725&nttId=10087787)
- **zkMe Proof of Accredited Investor.** 금융 원자료를 공개하지 않고 일정 소득·자산 등 투자자 자격을 확인하는 증명을 제품으로 소개한다. 제품이 증명하는 대상은 투자자 자격이다. 가입 건별 설명, 확인, 서명 순서나 해당 증권사의 적합성 규칙을 검증하는 사례는 확인하지 못했다. [zkMe 제품 설명](https://www.zk.me/solutions/rwa/)

## 기획에 반영할 점

여러 업체가 판매 모니터링, 적합성 판정, 감사 이력, 원본 무결성, 기관 간 원장 공유를 이미 제공한다. 차별화 가설은 증권사의 기존 청약 기록에서 **당시 규칙·설명서 버전·확인 기록·증명**을 같은 가입 ID로 묶고, 권한 있는 외부 검증자가 재검증할 수 있다는 점이다. 기록에 나타난 조건 충족을 검증한다. 최초 입력의 진실성과 고객의 실제 이해는 별도 확인이 필요하다.

파일럿에서 확인할 질문은 두 가지다. 판매사는 기존 시스템으로 이 증빙을 만드는 데 얼마나 시간이 드는가? 검사 담당자는 제안한 증빙을 받아 어떤 항목을 추가 자료 없이 확인할 수 있는가? 공개 자료만으로 구매 의사, 검사 자료로의 공식 채택, 국내 전 업체의 구축 현황을 판단할 수 없다.
