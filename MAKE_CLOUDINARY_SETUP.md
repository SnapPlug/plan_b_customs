# Make.com에서 Cloudinary 이미지 불러오기 설정 가이드

## 개요

웹사이트에서 Cloudinary에 업로드된 이미지를 Make.com에서 불러와 OCR 처리하는 방법입니다.

---

## 방법 1: Webhook을 통한 즉시 처리 (권장)

웹사이트에서 이미지 업로드 성공 시 Make.com으로 즉시 알림을 보내는 방식입니다.

### 1-1. Make.com Webhook 모듈 생성

1. Make.com 시나리오에서 **"Webhooks"** 모듈 추가
2. **"Custom webhook"** 선택
3. **"Add a webhook"** 클릭
4. Webhook URL 복사 (예: `https://hook.us1.make.com/xxxxx`)

### 1-2. Next.js에서 Webhook 호출 코드 추가

업로드 성공 후 Make.com Webhook으로 데이터 전송하도록 코드 수정이 필요합니다.

**필요한 정보:**
- Cloudinary 이미지 URL
- 사용자 정보 (이름/전화번호 또는 사업자명/사업자등록번호)

---

## 방법 2: Cloudinary Watch Uploaded Resources (실시간 트리거) ⭐ 현재 사용 중

Cloudinary 모듈의 "Watch Uploaded Resources" 기능을 사용하여 새 이미지 업로드 시 자동으로 Make.com을 트리거하는 방식입니다.

### 2-1. Cloudinary Watch 모듈 설정

**모듈**: Cloudinary → Watch Uploaded Resources

**설정**:
- **Resource Type**: `image`
- **Folder**: `receipts` (또는 특정 폴더 경로)
- **Polling Interval**: 5분 또는 원하는 간격

**동작 방식**:
- Cloudinary에 새 이미지가 업로드될 때마다 자동으로 트리거
- 각 이미지가 **개별적으로** 트리거됨 (여러 장 업로드 시 각각 별도 실행)
- 실시간 처리 가능

### 2-2. 여러 장 영수증 처리 방법

**⚠️ 중요**: Cloudinary Watch는 각 이미지가 업로드될 때마다 **개별적으로** 트리거됩니다.

**예시**: 3장의 영수증을 동시에 업로드하면:
- Cloudinary Watch가 3번 트리거됨 (각 이미지마다 1번씩)
- 각 실행은 독립적으로 처리됨

**워크플로우 구조**:
```
Cloudinary (Watch Uploaded Resources)
  → Filter (필요한 경우: 특정 폴더 또는 조건 확인)
  → Tools (메타데이터 추출: context.custom.invoice_name 등)
  → HTTP (Nanonets OCR)
  → Iterator [66] (OCR 아이템별 처리)
  → Google Sheets (결과 저장)
```

### 2-3. 메타데이터 추출 (구글 시트 저장용)

Cloudinary Watch 모듈의 출력에서 메타데이터를 추출합니다.

**메타데이터 경로**:
- **인보이스명**: `{{context.custom.invoice_name}}`
- **사용자 이름**: `{{context.custom.user_name}}`
- **사용자 전화번호**: `{{context.custom.user_phone}}`
- **이미지 URL**: `{{secure_url}}` 또는 `{{url}}`
- **Public ID**: `{{public_id}}`

**Tools 모듈을 사용하여 변수로 저장**:
```json
[
  {
    "name": "invoiceName",
    "value": "{{context.custom.invoice_name}}"
  },
  {
    "name": "userName",
    "value": "{{context.custom.user_name}}"
  },
  {
    "name": "userPhone",
    "value": "{{context.custom.user_phone}}"
  },
  {
    "name": "imageUrl",
    "value": "{{secure_url}}"
  }
]
```

### 2-4. 문제 해결: 여러 장이 한 장만 처리되는 경우

**원인 1: Filter 모듈이 너무 많은 것을 제외**
- **확인**: Cloudinary Watch 이후 Filter 모듈 확인
- **해결**: Filter 조건을 확인하고, 불필요한 제외 조건 제거
- **참고**: 각 이미지는 개별 트리거되므로 Filter 없이도 중복 처리되지 않음

**원인 2: Cloudinary Watch 폴더 설정 문제**
- **확인**: Watch 모듈의 Folder 설정이 올바른지 확인
- **해결**: `receipts` 또는 `receipts/{{인보이스명}}` 설정

**원인 3: 실행 로그 확인**
- **확인**: Make.com 실행 로그에서 각 이미지가 개별적으로 트리거되는지 확인
- **해결**: 각 이미지마다 별도 실행이 생성되어야 함

**원인 4: 동시 업로드 처리 지연**
- **문제**: 여러 장을 동시에 업로드하면 Cloudinary가 순차적으로 처리할 수 있음
- **해결**: 각 이미지가 완전히 업로드된 후에 Watch가 트리거되므로, 약간의 지연이 있을 수 있음

### 2-5. 디버깅 방법

1. **Cloudinary Watch 모듈 출력 확인**
   - 각 이미지가 개별적으로 트리거되는지 확인
   - `public_id`, `secure_url`, `context` 확인

2. **Filter 모듈 확인**
   - Filter 조건이 올바른지 확인
   - 테스트 실행으로 Filter 통과 여부 확인

3. **실행 로그 확인**
   - Make.com 실행 히스토리에서 각 이미지별 실행 확인
   - 실패한 실행이 있는지 확인

---

## 방법 3: Make.com에서 Cloudinary API 조회 (HTTP 모듈)

Make.com에서 주기적으로 Cloudinary API를 호출하여 새 이미지를 확인하는 방식입니다.

### 3-1. Make.com 시나리오 구조

```
Schedule (트리거) 또는 Webhook
  → HTTP (Cloudinary API 조회)
  → Iterator (각 이미지)
  → HTTP (Nanonets OCR)
  → Google Sheets (결과 저장)
```

### 3-2. HTTP 모듈: Cloudinary API 조회

**Method**: GET

**옵션 A: 모든 영수증 조회 (전체 폴더)**

**URL**: 
```
https://api.cloudinary.com/v1_1/{{CLOUD_NAME}}/resources/image?prefix=receipts&max_results=500&context=true
```

**옵션 B: 특정 인보이스 폴더의 모든 영수증 조회**

**URL**: 
```
https://api.cloudinary.com/v1_1/{{CLOUD_NAME}}/resources/image?prefix=receipts/{{인보이스명}}&max_results=500&context=true
```

예시: `prefix=receipts/홍길동_20250103`

**Headers**:
- **Authorization**: `Basic {{base64(API_KEY:API_SECRET)}}`

**설명**:
- `CLOUD_NAME`: Cloudinary 계정의 Cloud Name
- `prefix`: 조회할 폴더 경로
  - `receipts`: 모든 인보이스의 영수증 조회
  - `receipts/홍길동_20250103`: 특정 인보이스의 영수증만 조회
- `max_results`: 최대 조회 개수 (최대 500, 기본값 10)
  - **⚠️ 중요**: 여러 장의 영수증을 처리하려면 `max_results=500` 또는 더 큰 값 사용
- `context=true`: 메타데이터(인보이스명, 사용자 정보) 포함

**응답 예시**:
```json
{
  "resources": [
    {
      "public_id": "receipts/홍길동_20250103/홍길동_20250103_1735900000000",
      "secure_url": "https://res.cloudinary.com/xxx/image/upload/v1234567890/receipts/xxx.jpeg",
      "created_at": "2025-11-03T21:48:16Z",
      "format": "jpeg",
      "width": 1920,
      "height": 1080,
      "bytes": 3500000,
      "context": {
        "custom": {
          "invoice_name": "홍길동_20250103",
          "user_name": "홍길동",
          "user_phone": "01012345678"
        }
      }
    }
  ]
}
```

**⚠️ 중요 사항**:

1. **메타데이터 조회**: `context=true` 파라미터 필수
2. **여러 장 처리**: `max_results=500` 설정 (최대 500개)
3. **페이지네이션**: 500개 이상인 경우 `next_cursor` 사용

**응답에 `next_cursor`가 있는 경우 (500개 이상)**:
```
{
  "resources": [...],
  "next_cursor": "abc123..."
}
```

다음 페이지 조회:
```
https://api.cloudinary.com/v1_1/{{CLOUD_NAME}}/resources/image?prefix=receipts&max_results=500&context=true&next_cursor={{next_cursor}}
```

**특정 이미지의 상세 정보 조회**:
```
https://api.cloudinary.com/v1_1/{{CLOUD_NAME}}/resources/image/{{public_id}}?context=true
```

### 3-3. Iterator로 각 이미지 처리

HTTP 모듈의 `resources` 배열을 Iterator로 분리하여 각 이미지를 처리합니다.

**⚠️ 중요 설정**:

1. **Iterator 모듈 추가**
   - Array: `{{HTTP 응답의 resources}}`
   - 또는 JSONPath: `$.resources`

2. **Iterator 설정 확인**
   - **Bundle size**: `1` (각 이미지를 개별적으로 처리)
   - **Iterations**: `Unlimited` (모든 이미지 처리)

3. **페이지네이션 처리 (500개 이상인 경우)**
   - HTTP 응답에 `next_cursor`가 있으면:
   - Loop 모듈 또는 재귀 호출로 다음 페이지 조회
   - 또는 여러 HTTP 모듈을 연결하여 순차 처리

**예시: 페이지네이션 처리**
```
HTTP (첫 페이지 조회)
  → Iterator (각 이미지 처리)
  → Filter (next_cursor가 있는지 확인)
  → HTTP (다음 페이지 조회 - next_cursor 사용)
  → Iterator (각 이미지 처리)
  → ...
```

### 3-4. 메타데이터 추출 (구글 시트 저장용)

Iterator의 각 이미지에서 메타데이터를 추출합니다.

**메타데이터 경로**:
- **인보이스명**: `{{context.custom.invoice_name}}`
- **사용자 이름**: `{{context.custom.user_name}}`
- **사용자 전화번호**: `{{context.custom.user_phone}}`

또는 Tools 모듈을 사용하여 변수로 저장:
```json
[
  {
    "name": "invoiceName",
    "value": "{{context.custom.invoice_name}}"
  },
  {
    "name": "userName",
    "value": "{{context.custom.user_name}}"
  },
  {
    "name": "userPhone",
    "value": "{{context.custom.user_phone}}"
  }
]
```

### 3-5. HTTP 모듈: Nanonets OCR 호출

Iterator의 각 이미지에 대해 OCR을 처리합니다.

**Method**: POST

**URL**: 
```
https://app.nanonets.com/api/v2/OCR/Model/{{MODEL_ID}}/LabelFile/
```

**Headers**:
- **Authorization**: `Basic {{base64(API_KEY + ":")}}`

**Body Type**: URL 또는 File

**Body**:
- 이미지 URL을 직접 전달하거나
- Cloudinary URL에서 이미지 다운로드 후 전송

---

## 방법 4: Cloudinary Webhook 사용 (고급)

Cloudinary에서 업로드 완료 시 Make.com으로 자동 알림을 보내는 방식입니다.

### 4-1. Cloudinary Webhook 설정

1. Cloudinary 대시보드 → Settings → Upload
2. "Upload presets" 또는 "Upload settings" 에서 Webhook URL 설정
3. Make.com Webhook URL 입력

**주의**: 이 방법은 Cloudinary 설정이 필요하며, 웹사이트 코드 변경 없이 자동으로 작동합니다.

---

## 권장 워크플로우

### 옵션 A: 웹사이트 → Make.com Webhook (즉시 처리)

```
웹사이트 업로드 성공
  → Make.com Webhook 호출 (Cloudinary URL + 사용자 정보 + 인보이스명)
  → HTTP (Nanonets OCR - Cloudinary URL 사용)
  → Google Sheets (결과 저장: OCR 데이터 + 인보이스명 + 사용자 정보)
```

**장점**: 즉시 처리, 실시간 반응

**Webhook 데이터 구조**:
```json
{
  "url": "https://res.cloudinary.com/xxx/image/upload/...",
  "invoiceName": "홍길동_20250103",
  "userName": "홍길동",
  "userPhone": "01012345678"
}
```

### 옵션 B: Cloudinary Watch Uploaded Resources (실시간 트리거) ⭐ 권장

```
Cloudinary (Watch Uploaded Resources)
  → Filter (필요한 경우: 특정 폴더 또는 조건 확인)
  → Tools (메타데이터 추출: 인보이스명, 사용자 정보)
  → HTTP (Nanonets OCR)
  → Iterator [66] (OCR 아이템별 처리)
  → Google Sheets (결과 저장: OCR 데이터 + 인보이스명 + 사용자 정보)
```

**⚠️ 여러 장 영수증 처리 확인 사항**:

1. **Cloudinary Watch 모듈**: 
   - Folder 설정: `receipts` 또는 특정 폴더
   - 각 이미지가 개별적으로 트리거되는지 확인
2. **Filter 모듈**: 
   - 불필요한 제외 조건이 있는지 확인
   - 각 이미지는 개별 트리거되므로 중복 방지 필터는 일반적으로 불필요
3. **Tools 모듈**: 
   - 메타데이터 경로 확인: `{{context.custom.invoice_name}}` 등
4. **실행 로그**: 
   - 각 이미지마다 별도 실행이 생성되는지 확인

**장점**: 
- 실시간 처리
- 자동 트리거 (별도 스케줄 불필요)
- 각 이미지 개별 처리 (중복 걱정 없음)

### 옵션 C: Make.com 주기적 조회 (배치 처리)

```
Schedule (매 5분마다)
  → HTTP (Cloudinary API 조회 - context=true, max_results=500)
  → Filter (next_cursor 확인 - 페이지네이션 필요 여부)
  → Iterator (각 이미지 - Bundle size: 1, Iterations: Unlimited)
  → Filter (이미 처리된 이미지 제외)
  → Tools (메타데이터 추출: 인보이스명, 사용자 정보)
  → HTTP (Nanonets OCR)
  → Iterator [66] (OCR 아이템별 처리)
  → Google Sheets (결과 저장: OCR 데이터 + 인보이스명 + 사용자 정보)
```

**⚠️ 여러 장 영수증 처리 확인 사항**:

1. **HTTP 모듈**: `max_results=500` 설정 확인
2. **Iterator 모듈**: 
   - Array: `{{resources}}` 또는 `$.resources` 확인
   - Bundle size: `1` (각 이미지 개별 처리)
   - Iterations: `Unlimited` (모든 이미지 처리)
3. **Filter 모듈**: 이미 처리된 이미지 제외 로직 확인
   - 구글 시트에서 이미 저장된 `public_id` 또는 `url` 확인
4. **페이지네이션**: 500개 이상인 경우 `next_cursor` 처리

**장점**: 웹사이트 코드 변경 최소화

### 2-6. Google Sheets 저장 시 데이터 구조 (Cloudinary Watch 사용 시)

구글 시트에 저장할 데이터 구조 예시:

| 열 이름 | 데이터 소스 | 예시 값 |
|---------|------------|---------|
| 인보이스명 | `{{context.custom.invoice_name}}` 또는 `{{invoiceName}}` | 홍길동_20250103 |
| 사용자 이름 | `{{context.custom.user_name}}` 또는 `{{userName}}` | 홍길동 |
| 사용자 전화번호 | `{{context.custom.user_phone}}` 또는 `{{userPhone}}` | 01012345678 |
| 이미지 URL | `{{secure_url}}` | https://res.cloudinary.com/... |
| Public ID | `{{public_id}}` | receipts/홍길동_20250103/... |
| OCR 결과 | Nanonets OCR 응답 데이터 | ... |

**⚠️ 중요**: 인보이스명은 각 영수증 아이템별로 매핑되어야 하므로, Iterator [66]에서 각 아이템을 처리할 때 인보이스명을 함께 전달해야 합니다.

구글 시트에 저장할 데이터 구조 예시:

| 열 이름 | 데이터 소스 | 예시 값 |
|---------|------------|---------|
| 인보이스명 | `{{context.custom.invoice_name}}` 또는 `{{invoiceName}}` | 홍길동_20250103 |
| 사용자 이름 | `{{context.custom.user_name}}` 또는 `{{userName}}` | 홍길동 |
| 사용자 전화번호 | `{{context.custom.user_phone}}` 또는 `{{userPhone}}` | 01012345678 |
| 이미지 URL | `{{secure_url}}` | https://res.cloudinary.com/... |
| OCR 결과 | Nanonets OCR 응답 데이터 | ... |

**⚠️ 중요**: 인보이스명은 각 영수증 아이템별로 매핑되어야 하므로, Iterator [66]에서 각 아이템을 처리할 때 인보이스명을 함께 전달해야 합니다.

---

## 문제 해결: 여러 장의 영수증이 한 장만 처리되는 경우

### Cloudinary Watch Uploaded Resources 사용 시

**원인 및 해결 방법**:

1. **Filter 모듈이 너무 많은 것을 제외**
   - **문제**: Cloudinary Watch 이후 Filter가 모든 이미지를 제외
   - **해결**: 
     - Filter 조건 확인 및 수정
     - 각 이미지는 개별 트리거되므로 중복 방지 필터는 불필요할 수 있음
     - 테스트 실행으로 Filter 통과 여부 확인

2. **Cloudinary Watch 폴더 설정 문제**
   - **문제**: Watch 모듈이 올바른 폴더를 감지하지 못함
   - **해결**: 
     - Folder 설정: `receipts` 또는 `receipts/{{인보이스명}}`
     - Polling Interval 확인 (너무 길면 지연 가능)

3. **동시 업로드 처리 지연**
   - **문제**: 여러 장을 동시에 업로드하면 순차적으로 처리될 수 있음
   - **해결**: 
     - 각 이미지가 완전히 업로드된 후 Watch가 트리거되므로 약간의 지연 정상
     - 실행 로그에서 각 이미지가 개별적으로 트리거되는지 확인

4. **메타데이터 경로 오류**
   - **문제**: `context.custom.invoice_name` 등 메타데이터 경로가 잘못됨
   - **해결**: 
     - Cloudinary Watch 모듈 출력에서 `context` 구조 확인
     - Tools 모듈에서 올바른 경로 사용

### HTTP 모듈 사용 시 (방법 3)

1. **`max_results` 값이 너무 작음**
   - **문제**: 기본값 10으로 설정되어 있으면 10개만 조회
   - **해결**: `max_results=500` 설정

2. **Iterator 설정 오류**
   - **문제**: Array 경로가 잘못되었거나 Bundle size 설정 오류
   - **해결**: 
     - Array: `{{resources}}` 또는 JSONPath `$.resources` 확인
     - Bundle size: `1` (각 이미지 개별 처리)
     - Iterations: `Unlimited`

3. **페이지네이션이 필요한 경우**
   - **문제**: 500개 이상의 이미지가 있으면 다음 페이지 조회 필요
   - **해결**: `next_cursor`를 사용하여 다음 페이지 조회

4. **Filter 모듈이 너무 많은 이미지를 제외**
   - **문제**: 이미 처리된 이미지 필터가 잘못 설정되어 모든 이미지 제외
   - **해결**: Filter 조건 확인 및 수정

### 디버깅 방법

**Cloudinary Watch 사용 시**:

1. **Cloudinary Watch 모듈 출력 확인**
   - 각 이미지가 개별적으로 트리거되는지 확인
   - `public_id`, `secure_url`, `context` 구조 확인
   - 실행 로그에서 각 이미지마다 별도 실행이 생성되는지 확인

2. **Filter 모듈 확인**
   - Filter 조건이 올바른지 확인
   - 테스트 실행으로 Filter 통과 여부 확인
   - Filter를 일시적으로 비활성화하여 테스트

3. **실행 로그 확인**
   - Make.com 실행 히스토리에서 각 이미지별 실행 확인
   - 실패한 실행이 있는지 확인
   - 각 실행의 입력/출력 데이터 확인

**HTTP 모듈 사용 시**:

1. **HTTP 모듈 응답 확인**
   - `resources` 배열에 모든 이미지가 포함되어 있는지 확인
   - `next_cursor`가 있는지 확인

2. **Iterator 입력 확인**
   - Iterator 모듈의 입력 데이터 확인
   - 각 이미지가 개별적으로 처리되는지 확인

3. **로그 확인**
   - 각 모듈의 실행 로그 확인
   - 어느 단계에서 데이터가 누락되는지 확인

---

## 다음 단계

1. **방법 선택**: 옵션 A (Webhook) 또는 옵션 B (API 조회)
2. **Make.com 시나리오 구성**: 위 워크플로우에 따라 모듈 추가
3. **설정 확인**: 
   - `max_results=500` 설정
   - Iterator Bundle size: `1`, Iterations: `Unlimited`
   - Array 경로 확인
4. **테스트**: 여러 장의 영수증으로 전체 플로우 테스트

추가로 필요한 정보나 코드 수정이 필요하면 알려주세요!


