# 파일 저장 방식 변경 문서

> **작성일**: 2026-01-18
> **변경 사항**: LocalStorage → 서버 파일 시스템 (CDSS_STORAGE)

---

## 1. 변경 개요

LIS/RIS 파일 업로드 방식을 브라우저 LocalStorage에서 서버 파일 시스템으로 변경했습니다.

---

## 2. 기존 방식 (LocalStorage)

### 흐름
```
사용자 브라우저 → FileReader (base64) → LocalStorage
```

### 특징
| 항목 | 내용 |
|------|------|
| 저장 위치 | 브라우저 LocalStorage |
| 형식 | base64 인코딩 |
| 용량 제한 | ~5MB (브라우저 제한) |
| 영구성 | 브라우저 종속 (캐시 삭제 시 손실) |
| 공유 | 불가능 (개인 브라우저에만 존재) |
| DB 기록 | storageKey만 저장 |

### 코드 (삭제됨)
```typescript
// src/utils/fileStorage.ts
export function processFileUpload(file: File, ocsId: number): Promise<StoredFileInfo> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const storageKey = saveFileToStorage(ocsId, file.name, dataUrl);
      // LocalStorage에 저장
      localStorage.setItem(storageKey, dataUrl);
      resolve({ name, size, type, uploadedAt, storageKey });
    };
    reader.readAsDataURL(file);
  });
}
```

---

## 3. 새로운 방식 (서버 CDSS_STORAGE)

### 흐름
```
사용자 브라우저 → Django API → CDSS_STORAGE/{LIS|RIS}/{patient_number}/
```

### 특징
| 항목 | 내용 |
|------|------|
| 저장 위치 | 서버 파일 시스템 |
| 형식 | 원본 파일 그대로 |
| 용량 제한 | LIS: 10MB, RIS: 100MB |
| 영구성 | 영구 저장 |
| 공유 | 가능 (모든 사용자 접근) |
| DB 기록 | attachments 필드에 경로 저장 |

### 저장 경로
```
brain_tumor_dev/
└── CDSS_STORAGE/
    ├── LIS/
    │   └── {patient_number}/
    │       └── {ocs_id}_{uuid}_{filename}
    ├── RIS/
    │   └── {patient_number}/
    │       └── {ocs_id}_{uuid}_{filename}
    └── AI/
```

---

## 4. 수정된 파일

### 백엔드

#### `apps/ocs/views.py`
```python
# upload_lis_file 액션
@action(detail=True, methods=['post'], url_path='upload_lis_file')
def upload_lis_file(self, request, pk=None):
    # 파일을 CDSS_STORAGE/LIS에 저장
    lis_storage_path = getattr(settings, 'CDSS_LIS_STORAGE', None)

    # 환자별 폴더 생성
    patient_folder = Path(lis_storage_path) / patient_number
    patient_folder.mkdir(parents=True, exist_ok=True)

    # 고유 파일명 생성
    unique_filename = f"{ocs.id}_{uuid.uuid4().hex[:8]}_{uploaded_file.name}"
    file_path = patient_folder / unique_filename

    # 파일 저장
    with open(file_path, 'wb+') as destination:
        for chunk in uploaded_file.chunks():
            destination.write(chunk)

    # DB에 경로 기록
    file_info = {
        "name": uploaded_file.name,
        "storage_path": f"LIS/{patient_number}/{unique_filename}",
        "full_path": str(file_path),
        ...
    }
```

### 프론트엔드

#### `src/pages/ocs/LISStudyDetailPage.tsx`
```typescript
// 변경 전
import { processFileUpload } from '@/utils/fileStorage';

const handleFileUpload = async (e) => {
  const storedInfo = await processFileUpload(file, ocs.id);  // LocalStorage
};

// 변경 후
import { uploadLISFile } from '@/services/ocs.api';

const handleFileUpload = async (e) => {
  const response = await uploadLISFile(ocs.id, file);  // 서버 API
  await fetchOCSDetail();  // OCS 새로고침
};
```

#### `src/services/ocs.api.ts`
```typescript
export interface LISUploadResponse {
  file: {
    name: string;
    size: number;
    content_type: string;
    uploaded_at: string;
    uploaded_by: number;
    storage_path?: string;  // 추가됨
    full_path?: string;     // 추가됨
  };
  ...
}
```

---

## 5. DB 저장 형식

### attachments 필드 (JSON)
```json
{
  "files": [
    {
      "name": "gene_expression.csv",
      "size": 1024000,
      "content_type": "text/csv",
      "uploaded_at": "2026-01-18T10:30:00Z",
      "uploaded_by": 1,
      "storage_path": "LIS/P001/60_a1b2c3d4_gene_expression.csv",
      "full_path": "C:/0000/brain_tumor_dev/CDSS_STORAGE/LIS/P001/60_a1b2c3d4_gene_expression.csv"
    }
  ],
  "total_size": 1024000,
  "last_modified": "2026-01-18T10:30:00Z"
}
```

---

## 6. 허용 파일 형식

### LIS
- `.csv`, `.hl7`, `.json`, `.xml`
- 최대 10MB

### RIS
- `.dcm`, `.nii`, `.nii.gz`, `.zip`, `.json`, `.xml`
- 최대 100MB

---

## 7. 마이그레이션 참고

기존 LocalStorage에 저장된 파일은 자동으로 마이그레이션되지 않습니다.
필요 시 수동으로 다시 업로드해야 합니다.

---

## 8. 비교 요약

| 항목 | LocalStorage (기존) | CDSS_STORAGE (신규) |
|------|---------------------|---------------------|
| 저장 위치 | 브라우저 | 서버 파일 시스템 |
| 용량 | ~5MB | LIS 10MB / RIS 100MB |
| 영구성 | 브라우저 종속 | 영구 저장 |
| 공유 | 불가 | 가능 |
| DB 기록 | storageKey만 | 전체 경로 + 메타데이터 |
| 백업 | 불가 | 서버 백업 가능 |
