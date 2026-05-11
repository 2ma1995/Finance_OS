# 💰 Finance OS

> 사내 경비 관리 자동화 시스템 — Slack 영수증 업로드부터 결재·정산까지

<details>
  <summary>1️. Slack 연동 시연</summary>
  <img src="./assets/slack_1.gif">
</details>

<details>
  <summary>2. 통계 대시보드 시연_영수증확인</summary>
  <img src="./assets/slack_2.gif">
</details>

<details>
  <summary>3. 통계 대시보드 시연_영수증처리</summary>
  <img src="./assets/slack_3.gif">
</details>

<details>
  <summary>4. 통계 대시보드 시연_완료</summary>
  <img src="./assets/page.png">
</details>

---

## 📌 프로젝트 소개

**Finance OS**는 사내 경비 처리를 자동화하는 재무 관리 시스템입니다.

직원·재무팀이 Slack 또는 웹 폼으로 영수증을 제출하면 Google Cloud Vision OCR이 금액·상호명·공급가액·부가세·면세금액을 자동 추출합니다. 계층적 결재 구조로 직원·CEO 영수증은 재무팀이, 재무팀·CEO 본인 영수증은 CEO가 승인·반려합니다. CEO·재무·직원 세 가지 역할에 따라 접근 권한이 분리되고 실시간으로 데이터가 동기화됩니다.

---

## ✨ 전체 기능

### 1. Slack 영수증 자동 처리
- Slack 채널에 영수증 이미지 업로드 → Webhook으로 자동 수신
- Google Cloud Vision OCR로 금액·상호명·공급가액·부가세·면세금액 추출
- 인식 완료 후 카테고리 선택 버튼을 Slack 스레드로 전송
- OCR 검증 불일치(공급가액+부가세 ≠ 합계) 시 알림 채널에 경고 메시지 발송

### 2. 웹 폼 영수증 제출 (직원·재무)
- 영수증 이미지 업로드 → OCR 자동 인식 후 금액·상호명 자동 입력
- 공급가액·부가세·면세금액도 OCR 인식 후 자동 입력, 수동 수정 가능
- 카테고리 선택 및 메모 입력 후 제출
- 내 영수증 목록에서 상태(대기/승인/반려) 실시간 확인
- 대기 중인 영수증 수정 가능 (공급가액·부가세·면세금액 포함)
- 반려 시 Slack DM으로 반려 사유 자동 알림

### 3. 결재 관리 (재무·CEO, 계층적 구조)
- **재무팀**: 직원(staff) 및 CEO가 제출한 영수증 승인·반려
- **CEO**: 재무팀(finance)이 제출한 영수증 및 본인 영수증 승인·반려
- 부서·카테고리·날짜 범위로 필터링
- 영수증별 승인 / 반려(사유 입력) 처리
- 영수증 이미지 바로 보기
- 영수증 내용 직접 수정 (금액·상호명·카테고리·공급가액·부가세·면세금액)
- 반려 시 제출자에게 Slack DM 자동 발송

### 4. 대시보드 (CEO)
- 총 수입·지출·순이익 KPI 카드
- 부서별 예산 대비 지출 바 차트
- 카테고리별 지출 도넛 차트
- 최근 영수증 실시간 목록

### 5. 거래내역 관리 (재무·CEO)
- 수입·지출 전체 거래 조회
- 수입 직접 등록
- 거래 삭제 (확인 문구 입력 방식으로 이중 확인)
- 행 클릭 시 상세 정보 표시 (영수증 이미지 링크 포함)

### 6. 예산 관리 (재무·CEO)
- 부서별 월별 예산 설정 및 수정
- 부서 추가 시 DB에 등록된 직원 부서 목록을 드롭다운으로 표시
- 예산 대비 실지출 현황 확인

### 7. 직원·부서 관리 (CEO)
- 직원 목록 조회
- 역할 변경 (CEO / 재무 / 직원)
- 재직 상태 활성·비활성 전환
- 부서 추가 및 직원별 부서 배정 (부서별 소속 인원 현황 카드 제공)

### 8. 보고서 (재무·CEO)
- 월별 수입·지출 집계
- 카테고리별 지출 상세 내역

---

## 🏗️ 시스템 아키텍처

![System Architecture](./assets/finance_os_architecture_v3.svg)

> **ngrok이 필요한 이유**
> Slack은 공개된 URL로만 Webhook을 전송합니다.
> 로컬 환경에서는 ngrok으로 터널링이 필요하며, Vercel 등에 배포하면 ngrok 없이 동작합니다.

---

## 👥 역할별 접근 권한

| 기능 | 직원 (staff) | 재무 (finance) | CEO |
|------|:---:|:---:|:---:|
| 영수증 제출 | ✅ | ✅ | ✅ |
| 내 영수증 조회·수정 | ✅ | ✅ | ✅ |
| 결재 — 직원·CEO 영수증 승인·반려 | | ✅ | |
| 결재 — 재무팀·본인 영수증 승인·반려 | | | ✅ |
| 거래내역 | | ✅ | ✅ |
| 예산 관리 | | ✅ | ✅ |
| 보고서 | | ✅ | ✅ |
| 대시보드 | | | ✅ |
| 직원·부서 관리 | | | ✅ |

---

## 🛠️ 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | Next.js 15 App Router, React 19, TypeScript |
| **UI** | shadcn/ui, Tailwind CSS, Recharts |
| **Backend** | Next.js API Routes, Server Actions |
| **Database** | Supabase (PostgreSQL + Realtime) |
| **OCR** | Python FastAPI, Google Cloud Vision API |
| **자동화** | Slack Bot API, Event Subscriptions, Interactivity |
| **인프라** | Docker Compose, ngrok |

---

## 🔄 Slack 연동 흐름

```
1. 직원이 Slack 채널에 영수증 이미지 업로드
2. Slack이 ngrok URL로 Webhook 이벤트 전송
3. Next.js /api/slack-webhook 수신 → Supabase Storage에 이미지 저장
4. Python OCR 서버(Docker, Port 8000)로 이미지 전달
5. Google Cloud Vision API → 금액·상호명·공급가액·부가세 추출
6. 추출 데이터를 Supabase DB에 저장
7. Slack 스레드에 카테고리 선택 버튼 전송
8. 직원이 버튼 클릭 → /api/slack-interactions → 카테고리 업데이트
9. 웹 대시보드에서 재무팀이 확인 후 승인/반려 (재무팀 영수증은 CEO가 처리)
```

---

## 🚀 로컬 실행 방법

### 사전 준비

- Node.js 20+
- Docker & Docker Compose
- Supabase 프로젝트
- Slack App (Bot Token, Signing Secret)
- Google Cloud Vision API (서비스 계정 또는 ADC)
- ngrok

### 환경변수 설정

`.env.local.example`을 복사해 `.env.local` 생성:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# OCR 서버
OCR_SERVER_URL=http://localhost:8000

# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_ALERT_CHANNEL=C0XXXXXXXXX

# Google Cloud Vision
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 실행 순서

```bash
# 1. 저장소 클론
git clone https://github.com/2ma1995/Finance_OS.git
cd Finance_OS

# 2. 패키지 설치
npm install

# 3. OCR 서버 실행 (Docker)
docker-compose up -d

# 4. Next.js 앱 실행
npm run dev

# 5. ngrok으로 외부 URL 생성 (Slack Webhook용)
ngrok http 3000
```

### Slack App 설정

ngrok 실행 후 출력되는 URL을 Slack App에 등록:

| 항목 | URL |
|------|-----|
| Event Subscriptions | `https://xxxx.ngrok-free.app/api/slack-webhook` |
| Interactivity & Shortcuts | `https://xxxx.ngrok-free.app/api/slack-interactions` |

---

## 📁 프로젝트 구조

```
Finance_OS/
├── app/
│   ├── actions/          # Server Actions (receipts, transactions, budgets, employees)
│   ├── api/              # API Routes (categorize, slack-webhook, slack-interactions, receipt-image)
│   ├── approvals/        # 결재 관리 페이지
│   ├── dashboard/        # 대시보드
│   ├── submit/           # 영수증 제출 (직원)
│   ├── transactions/     # 거래내역
│   ├── budgets/          # 예산 관리
│   ├── reports/          # 보고서
│   └── settings/         # 직원·부서 관리
├── components/           # 재사용 UI 컴포넌트
├── lib/                  # Supabase 클라이언트, 인증 유틸
├── ocr-server/           # Python FastAPI OCR 서버
├── types/                # TypeScript 타입 정의
├── docker-compose.yml    # OCR 서버 컨테이너
└── proxy.ts              # 미들웨어 (인증·역할 기반 라우팅)
```

---

## 📄 라이선스

MIT License
