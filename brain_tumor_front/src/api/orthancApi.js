// src/api/orthancApi.js
import { http } from "./http";
import { EP } from "./endpoints";

export async function uploadPatientFolder({
  patientId,
  patientName,
  studyDescription,
  studyInstanceUID,
  ocsId,
  files,
  seriesPaths,
}) {
  const fd = new FormData();

  fd.append("patient_id", patientId);
  fd.append("patient_name", patientName || patientId);  // 환자 이름 추가
  fd.append("study_description", studyDescription || "");
  if (studyInstanceUID) fd.append("study_instance_uid", studyInstanceUID);
  if (ocsId) fd.append("ocs_id", String(ocsId));

  for (const f of files) fd.append("files", f);
  for (const sp of seriesPaths) fd.append("series_path", sp);

  // ✅ 올바른 endpoint 키 사용
  const res = await http.post(EP.orthanc.uploadPatient, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}

export async function getPatients() {
  const res = await http.get(EP.orthanc.patients);
  return res.data || [];
}

export async function getStudies(patientOrthancId) {
  const res = await http.get(EP.orthanc.studies, {
    params: { patient_id: patientOrthancId },
  });
  return res.data || [];
}

export async function getSeries(studyOrthancId) {
  const res = await http.get(EP.orthanc.series, {
    params: { study_id: studyOrthancId },
  });
  return res.data || [];
}

export async function getInstances(seriesOrthancId) {
  const res = await http.get(EP.orthanc.instances, {
    params: { series_id: seriesOrthancId },
  });
  return res.data || [];
}

export function getInstanceFileUrl(orthancId) {
  const base =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
  return `${base}${EP.orthanc.instanceFile(orthancId)}`;
}

// 시리즈 썸네일 이미지 URL (중간 슬라이스)
export function getSeriesThumbnailUrl(seriesOrthancId) {
  const base =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
  return `${base}${EP.orthanc.seriesThumbnail(seriesOrthancId)}`;
}

// 시리즈 썸네일 이미지를 Base64로 가져오기
export async function getSeriesPreviewBase64(seriesOrthancId) {
  const endpoint = EP.orthanc.seriesThumbnail(seriesOrthancId);

  try {
    console.log(`[OrthancAPI] 시리즈 썸네일 요청: ${seriesOrthancId}`);

    const res = await http.get(endpoint, {
      responseType: 'arraybuffer'
    });

    if (!res.data || res.data.byteLength === 0) {
      console.warn(`[OrthancAPI] 썸네일 데이터 비어있음: ${seriesOrthancId}`);
      return null;
    }

    const base64 = btoa(
      new Uint8Array(res.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    const contentType = res.headers['content-type'] || 'image/png';

    console.log(`[OrthancAPI] 썸네일 로딩 성공: ${seriesOrthancId} (${res.data.byteLength} bytes)`);

    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    const status = error?.response?.status;
    const errMsg = error?.response?.data
      ? new TextDecoder().decode(error.response.data).slice(0, 100)
      : error?.message;

    console.error(`[OrthancAPI] 시리즈 썸네일 실패 (${status || 'N/A'}): ${seriesOrthancId}`, errMsg);
    return null;
  }
}

// Orthanc Study 삭제
export async function deleteStudy(studyOrthancId) {
  const res = await http.delete(EP.orthanc.deleteStudy(studyOrthancId));
  return res.data;
}
