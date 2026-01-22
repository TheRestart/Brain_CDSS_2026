/**
 * LocalStorage 기반 파일 저장 유틸리티
 * - 대용량 base64 데이터를 LocalStorage에 저장
 * - worker_result에는 참조 키만 저장하여 JSON 크기 최소화
 */

// 파일 저장 키 프리픽스
const FILE_STORAGE_PREFIX = 'ocs_file_';

// 메타데이터 저장 키 (향후 사용 예정)
// const FILE_META_PREFIX = 'ocs_file_meta_';

// 파일 메타데이터 인터페이스
export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  storageKey: string;  // LocalStorage 참조 키
}

// worker_result에 저장되는 파일 정보 (dataUrl 제외)
export interface StoredFileInfo {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  storageKey: string;  // LocalStorage 참조 키
  // dataUrl은 더 이상 직접 저장하지 않음
}

// 내부 사용: dataUrl 포함 파일 정보
export interface FileWithData extends StoredFileInfo {
  dataUrl?: string;
}

/**
 * 파일 저장 키 생성
 * 형식: ocs_file_{ocsId}_{timestamp}_{filename_hash}
 */
export function generateFileStorageKey(ocsId: number | string, fileName: string): string {
  const timestamp = Date.now();
  // 파일명에서 특수문자 제거하고 해시 생성
  const safeFileName = fileName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  return `${FILE_STORAGE_PREFIX}${ocsId}_${timestamp}_${safeFileName}`;
}

/**
 * LocalStorage에 파일 데이터(base64) 저장
 * @returns 저장 키 (성공 시) 또는 null (실패 시)
 */
export function saveFileToStorage(
  ocsId: number | string,
  fileName: string,
  dataUrl: string
): string | null {
  try {
    const storageKey = generateFileStorageKey(ocsId, fileName);
    localStorage.setItem(storageKey, dataUrl);
    console.log(`[FileStorage] Saved: ${storageKey} (${(dataUrl.length / 1024).toFixed(1)} KB)`);
    return storageKey;
  } catch (error) {
    // LocalStorage 용량 초과 등의 에러
    console.error('[FileStorage] Failed to save file:', error);
    return null;
  }
}

/**
 * LocalStorage에서 파일 데이터 가져오기
 */
export function getFileFromStorage(storageKey: string): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch (error) {
    console.error('[FileStorage] Failed to get file:', error);
    return null;
  }
}

/**
 * LocalStorage에서 파일 삭제
 */
export function removeFileFromStorage(storageKey: string): boolean {
  try {
    localStorage.removeItem(storageKey);
    console.log(`[FileStorage] Removed: ${storageKey}`);
    return true;
  } catch (error) {
    console.error('[FileStorage] Failed to remove file:', error);
    return false;
  }
}

/**
 * OCS ID에 해당하는 모든 파일 삭제
 */
export function removeAllFilesForOCS(ocsId: number | string): number {
  let count = 0;
  try {
    const prefix = `${FILE_STORAGE_PREFIX}${ocsId}_`;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      count++;
    });

    console.log(`[FileStorage] Removed ${count} files for OCS ${ocsId}`);
  } catch (error) {
    console.error('[FileStorage] Failed to remove files for OCS:', error);
  }
  return count;
}

/**
 * 파일 업로드 처리 (FileReader + LocalStorage 저장)
 * @returns Promise<StoredFileInfo>
 */
export function processFileUpload(
  file: File,
  ocsId: number | string
): Promise<StoredFileInfo> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = reader.result as string;
      const storageKey = saveFileToStorage(ocsId, file.name, dataUrl);

      if (!storageKey) {
        reject(new Error('LocalStorage 저장 실패 (용량 초과 가능)'));
        return;
      }

      const fileInfo: StoredFileInfo = {
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        storageKey,
      };

      resolve(fileInfo);
    };

    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 저장된 파일 정보에서 dataUrl 로드
 */
export function loadFileWithData(fileInfo: StoredFileInfo): FileWithData {
  const dataUrl = fileInfo.storageKey
    ? getFileFromStorage(fileInfo.storageKey)
    : null;

  return {
    ...fileInfo,
    dataUrl: dataUrl || undefined,
  };
}

/**
 * 여러 파일의 dataUrl 일괄 로드
 */
export function loadFilesWithData(files: StoredFileInfo[]): FileWithData[] {
  return files.map(loadFileWithData);
}

/**
 * 기존 형식(dataUrl 직접 저장)에서 새 형식(LocalStorage 참조)으로 마이그레이션
 * - 기존 files[].dataUrl이 있으면 LocalStorage로 이동
 * - storageKey가 없는 경우에만 처리
 */
export function migrateFilesToStorage(
  files: Array<{ name: string; size: number; type: string; uploadedAt: string; dataUrl?: string; storageKey?: string }>,
  ocsId: number | string
): StoredFileInfo[] {
  return files.map((file) => {
    // 이미 마이그레이션된 경우 (storageKey 있음)
    if (file.storageKey) {
      return {
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: file.uploadedAt,
        storageKey: file.storageKey,
      };
    }

    // dataUrl이 있으면 LocalStorage로 이동
    if (file.dataUrl) {
      const storageKey = saveFileToStorage(ocsId, file.name, file.dataUrl);
      return {
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: file.uploadedAt,
        storageKey: storageKey || '', // 저장 실패 시 빈 문자열
      };
    }

    // dataUrl도 storageKey도 없는 경우
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: file.uploadedAt,
      storageKey: '',
    };
  });
}

/**
 * LocalStorage 사용량 확인
 */
export function getStorageUsage(): { used: number; total: number; percent: number } {
  let used = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          used += key.length + value.length;
        }
      }
    }
  } catch (error) {
    console.error('[FileStorage] Failed to calculate storage usage:', error);
  }

  // 대략적인 LocalStorage 제한 (5MB)
  const total = 5 * 1024 * 1024;
  const percent = Math.round((used / total) * 100);

  return { used, total, percent };
}

/**
 * OCS별 파일 저장소 사용량 확인
 */
export function getOCSStorageUsage(ocsId: number | string): number {
  let used = 0;
  const prefix = `${FILE_STORAGE_PREFIX}${ocsId}_`;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const value = localStorage.getItem(key);
        if (value) {
          used += value.length;
        }
      }
    }
  } catch (error) {
    console.error('[FileStorage] Failed to calculate OCS storage usage:', error);
  }

  return used;
}
