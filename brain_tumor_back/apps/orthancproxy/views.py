from django.shortcuts import render

# Create your views here.
# (예) orthancproxy/views.py  또는 현재 올리신 views.py 파일에 그대로 복붙

import io
import logging
from typing import List
import uuid
from datetime import datetime
import json
from pprint import pformat

import pydicom
from pydicom.uid import generate_uid
import requests
from django.conf import settings
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)

if not logger.handlers:
    _handler = logging.StreamHandler()
    _formatter = logging.Formatter("[%(levelname)s] %(asctime)s %(name)s: %(message)s")
    _handler.setFormatter(_formatter)
    logger.addHandler(_handler)

logger.setLevel(logging.INFO)
logger.propagate = False

ORTHANC_DEBUG_LOG = getattr(settings, "ORTHANC_DEBUG_LOG", True)


def dlog(label: str, payload):
    if not ORTHANC_DEBUG_LOG:
        return
    try:
        text = json.dumps(payload, indent=2, default=str)
    except Exception:
        try:
            text = pformat(payload)
        except Exception as e:
            text = f"<unprintable payload type={type(payload)} error={e}>"

    MAX_LEN = 3000
    if len(text) > MAX_LEN:
        text = text[:MAX_LEN] + "\n... (truncated) ..."

    logger.info("%s:\n%s", label, text)


ORTHANC = settings.ORTHANC_BASE_URL.rstrip("/")


def _get(path: str):
    url = f"{ORTHANC}{path}"
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    return r.json()


def _delete(path: str):
    url = f"{ORTHANC}{path}"
    r = requests.delete(url, timeout=10)
    r.raise_for_status()
    return r.json() if r.text else {}


def _post_instance(dicom_bytes: bytes):
    url = f"{ORTHANC}/instances"
    r = requests.post(
        url,
        data=dicom_bytes,
        headers={"Content-Type": "application/dicom"},
        timeout=30,
    )
    r.raise_for_status()
    try:
        return r.json()
    except Exception:
        return {}


def _normalize_tag_value(v):
    if v is None:
        return ""
    if isinstance(v, list):
        return _normalize_tag_value(v[0]) if v else ""
    if isinstance(v, dict):
        if "Value" in v:
            return _normalize_tag_value(v["Value"])
        if "value" in v:
            return _normalize_tag_value(v["value"])
        return ""
    return str(v)


def _parse_series_type(series_description: str) -> str:
    """
    SeriesDescription에서 MRI 시퀀스 타입을 파싱합니다.

    Returns:
        T1, T2, T1C (T1 contrast), FLAIR, DWI, SWI, SEG, OTHER
    """
    if not series_description:
        return "OTHER"

    desc_upper = series_description.upper()

    # SEG (Segmentation) - 분할 마스크, 레이블 등
    seg_patterns = ['SEG', 'SEGMENT', 'MASK', 'LABEL', 'ROI', 'ANNOTATION']
    for pattern in seg_patterns:
        if pattern in desc_upper:
            return "SEG"

    # DWI (Diffusion Weighted Imaging) - 확산 강조 영상
    dwi_patterns = ['DWI', 'DIFFUSION', 'DW-', 'DW_', 'DW ', 'ADC', 'B1000', 'B0', 'TRACE']
    for pattern in dwi_patterns:
        if pattern in desc_upper:
            return "DWI"

    # SWI (Susceptibility Weighted Imaging) - 자화율 강조 영상
    swi_patterns = ['SWI', 'SUSCEPTIBILITY', 'SW-', 'SW_', 'SW ', 'T2*', 'T2STAR', 'GRE', 'GRADIENT ECHO']
    for pattern in swi_patterns:
        if pattern in desc_upper:
            return "SWI"

    # T1C (T1 contrast/enhanced) - T1C, T1+C, T1 GAD, T1 CONTRAST, POST 등
    t1c_patterns = ['T1C', 'T1+C', 'T1 C', 'T1+GAD', 'T1 GAD', 'T1POST', 'T1 POST',
                    'POST GAD', 'POST CONTRAST', 'CONTRAST', '+C', 'CE-', 'CE_',
                    'POSTCONTRAST', 'POST-CONTRAST', 'ENHANCED', 'T1W+C']
    for pattern in t1c_patterns:
        if pattern in desc_upper:
            return "T1C"

    # FLAIR - 우선순위 높음 (T2 FLAIR도 FLAIR로 분류)
    if 'FLAIR' in desc_upper:
        return "FLAIR"

    # T2 - T2, T2W, T2-weighted 등
    t2_patterns = ['T2W', 'T2-W', 'T2 W', 'T2_W']
    for pattern in t2_patterns:
        if pattern in desc_upper:
            return "T2"
    if 'T2' in desc_upper:
        return "T2"

    # T1 (contrast 아닌 것) - T1, T1W, T1-weighted 등
    t1_patterns = ['T1W', 'T1-W', 'T1 W', 'T1_W', 'T1 PRE', 'T1PRE', 'PRE GAD', 'PRE CONTRAST']
    for pattern in t1_patterns:
        if pattern in desc_upper:
            return "T1"
    if 'T1' in desc_upper:
        return "T1"

    return "OTHER"


def _auto_cleanup_if_empty(patient_id=None, study_id=None):
    try:
        if study_id:
            study = _get(f"/studies/{study_id}")
            if not study.get("Series", []):
                logger.info(f"Auto-clean: deleting empty study {study_id}")
                _delete(f"/studies/{study_id}")
                study_id = None

        if patient_id:
            patient = _get(f"/patients/{patient_id}")
            if not patient.get("Studies", []):
                logger.info(f"Auto-clean: deleting empty patient {patient_id}")
                _delete(f"/patients/{patient_id}")

    except Exception as e:
        logger.warning("auto-cleanup skipped: %s", e)


@api_view(["GET"])
@permission_classes([AllowAny])
def list_patients(request):
    try:
        ids: List[str] = _get("/patients")
        result = []

        for pid in ids:
            try:
                detail = _get(f"/patients/{pid}")
                tags = detail.get("MainDicomTags", {}) or {}
                result.append(
                    {
                        "orthancId": pid,
                        "patientId": tags.get("PatientID", ""),
                        "patientName": tags.get("PatientName", ""),
                        "studiesCount": len(detail.get("Studies", [])),
                    }
                )
            except Exception as e:
                logger.warning("patient read failed %s: %s", pid, e)

        result.sort(key=lambda x: (x["patientId"], x["orthancId"]))
        dlog("list_patients result", {"count": len(result), "items": result})
        return Response(result)

    except Exception as e:
        logger.exception("list_patients error")
        data = {"detail": str(e)}
        dlog("list_patients error", data)
        return Response(data, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def list_studies(request):
    pid = request.query_params.get("patient_id")
    if not pid:
        data = {"detail": "patient_id is required"}
        dlog("list_studies bad_request", data)
        return Response(data, status=400)

    try:
        p = _get(f"/patients/{pid}")
        study_ids: List[str] = p.get("Studies", [])
        result = []

        for sid in study_ids:
            try:
                s = _get(f"/studies/{sid}")
                tags = s.get("MainDicomTags", {}) or {}
                result.append(
                    {
                        "orthancId": sid,
                        "studyInstanceUID": tags.get("StudyInstanceUID", ""),
                        "description": tags.get("StudyDescription", ""),
                        "studyDate": tags.get("StudyDate", ""),
                        "seriesCount": len(s.get("Series", [])),
                    }
                )
            except Exception as e:
                logger.warning("study read failed %s: %s", sid, e)

        result.sort(key=lambda x: (x["studyDate"], x["orthancId"]))
        dlog("list_studies result", {"count": len(result), "items": result})
        return Response(result)

    except Exception as e:
        logger.exception("list_studies error")
        data = {"detail": str(e)}
        dlog("list_studies error", data)
        return Response(data, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def list_series(request):
    sid = request.query_params.get("study_id")
    if not sid:
        data = {"detail": "study_id is required"}
        dlog("list_series bad_request", data)
        return Response(data, status=400)

    try:
        s = _get(f"/studies/{sid}")
        series_ids: List[str] = s.get("Series", [])
        result = []

        for ser_id in series_ids:
            try:
                ser = _get(f"/series/{ser_id}")
                tags = ser.get("MainDicomTags", {}) or {}
                series_desc = tags.get("SeriesDescription", "")
                result.append(
                    {
                        "orthancId": ser_id,
                        "seriesInstanceUID": tags.get("SeriesInstanceUID", ""),
                        "seriesNumber": tags.get("SeriesNumber", ""),
                        "description": series_desc,
                        "seriesType": _parse_series_type(series_desc),  # T1, T2, T1C, FLAIR, OTHER
                        "modality": tags.get("Modality", ""),
                        "instancesCount": len(ser.get("Instances", [])),
                    }
                )
            except Exception as e:
                logger.warning("series read failed %s: %s", ser_id, e)

        result.sort(key=lambda x: (str(x["seriesNumber"]), x["orthancId"]))
        dlog("list_series result", {"count": len(result), "items": result})
        return Response(result)

    except Exception as e:
        logger.exception("list_series error")
        data = {"detail": str(e)}
        dlog("list_series error", data)
        return Response(data, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def list_instances(request):
    sid = request.query_params.get("series_id")
    if not sid:
        data = {"detail": "series_id is required"}
        dlog("list_instances bad_request", data)
        return Response(data, status=400)

    try:
        ser = _get(f"/series/{sid}")
        ids: List[str] = ser.get("Instances", [])
        logger.info("list_instances called: series_id=%s, instances=%d", sid, len(ids))

        result = []

        for idx, inst_id in enumerate(ids, start=1):
            try:
                tags = _get(f"/instances/{inst_id}/simplified-tags")
                if idx <= 3:
                    dlog(f"simplified-tags for {inst_id}", tags)

                num = _normalize_tag_value(tags.get("InstanceNumber"))
                try:
                    num_int = int(num)
                except Exception:
                    num_int = None

                sop = _normalize_tag_value(tags.get("SOPInstanceUID"))

                rows = _normalize_tag_value(tags.get("Rows"))
                cols = _normalize_tag_value(tags.get("Columns"))
                pixel_spacing = _normalize_tag_value(tags.get("PixelSpacing"))
                slice_thickness = _normalize_tag_value(tags.get("SliceThickness"))
                slice_location = _normalize_tag_value(tags.get("SliceLocation"))
                image_position_patient = _normalize_tag_value(tags.get("ImagePositionPatient"))

                meta = {
                    "orthancId": inst_id,
                    "instanceNumber": num,
                    "instanceNumberInt": num_int,
                    "sopInstanceUID": sop,
                    "rows": rows,
                    "columns": cols,
                    "pixelSpacing": pixel_spacing,
                    "sliceThickness": slice_thickness,
                    "sliceLocation": slice_location,
                    "imagePositionPatient": image_position_patient,
                    "patientId": _normalize_tag_value(tags.get("PatientID")),
                    "patientName": _normalize_tag_value(tags.get("PatientName")),
                    "studyInstanceUID": _normalize_tag_value(tags.get("StudyInstanceUID")),
                    "seriesInstanceUID": _normalize_tag_value(tags.get("SeriesInstanceUID")),
                    "seriesNumber": _normalize_tag_value(tags.get("SeriesNumber")),
                }

                if idx <= 3:
                    dlog(f"built meta for {inst_id}", meta)

                result.append(meta)

            except Exception as e:
                logger.warning("instance read failed %s: %s", inst_id, e)

        result.sort(key=lambda x: (x["instanceNumberInt"] or 0))
        dlog("list_instances result", {"count": len(result), "first": result[0] if result else None})
        return Response(result)

    except Exception as e:
        logger.exception("list_instances error")
        data = {"detail": str(e)}
        dlog("list_instances error", data)
        return Response(data, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_instance_file(request, instance_id: str):
    try:
        r = requests.get(f"{ORTHANC}/instances/{instance_id}/file", timeout=20)
        r.raise_for_status()
        dlog("get_instance_file info", {"instance_id": instance_id, "content_length": len(r.content)})
        return HttpResponse(r.content, content_type="application/dicom")
    except Exception as e:
        logger.exception("get_instance_file error")
        data = {"detail": str(e)}
        dlog("get_instance_file error", data)
        return Response(data, status=500)


# -------------------------------------------------------------
# 6) 폴더 업로드 → 통합 Study / Series 생성
#    - OCS 연동: study_instance_uid, ocs_id 파라미터 지원
#    - StudyInstanceUID 형식: 1.2.410.200001.{ocs_id}.{timestamp}
# -------------------------------------------------------------
@api_view(["POST"])
def upload_patient(request):
    patient_id = request.data.get("patient_id") or request.data.get("patientId")

    # Patient Name (환자 이름) - 없으면 patient_id 사용
    patient_name = (
        request.data.get("patient_name")
        or request.data.get("patientName")
        or patient_id
        or ""
    ).strip()

    # Study Description (프론트에서 study_description으로 전송)
    study_description = (
        request.data.get("study_description")
        or request.data.get("studyDescription")
        or ""
    ).strip()

    # OCS 연동 파라미터: study_instance_uid, ocs_id
    study_instance_uid = (
        request.data.get("study_instance_uid")
        or request.data.get("studyInstanceUID")
        or ""
    ).strip()

    ocs_id = request.data.get("ocs_id") or request.data.get("ocsId") or ""

    files = request.FILES.getlist("files")
    series_paths = request.data.getlist("series_path") or request.data.getlist("seriesPath")

    if not patient_id:
        data = {"detail": "patient_id is required"}
        dlog("upload_patient bad_request", data)
        return Response(data, status=400)

    if not files:
        data = {"detail": "no files"}
        dlog("upload_patient bad_request", data)
        return Response(data, status=400)

    if not series_paths or len(series_paths) != len(files):
        data = {
            "detail": "series_path count must match files count",
            "filesCount": len(files),
            "seriesPathCount": len(series_paths),
        }
        dlog("upload_patient bad_request", data)
        return Response(data, status=400)

    # StudyInstanceUID: 프론트에서 전달받거나, 없으면 자동 생성
    # 형식: 1.2.410.200001.{ocs_id}.{timestamp} 또는 pydicom generate_uid()
    if study_instance_uid:
        study_uid = study_instance_uid
    else:
        study_uid = generate_uid()

    study_id = str(uuid.uuid4())

    series_uid_map = {}
    series_num_map = {}
    next_num = 1

    uploaded_series = set()
    uploaded = 0
    errors = []

    now = datetime.now()
    def_date = now.strftime("%Y%m%d")
    def_time = now.strftime("%H%M%S")

    # ✅ 한글 인코딩 문제 방지: ASCII 문자만 사용
    # PatientName, StudyDescription에 한글이 있으면 Orthanc에서 "??"로 표시됨
    def to_ascii_safe(text, default="Unknown"):
        """한글/특수문자를 제거하고 ASCII만 반환"""
        if not text:
            return default
        # ASCII 문자만 유지
        result = ''.join(c if ord(c) < 128 else '' for c in str(text)).strip()
        return result if result else default

    # study_description 비어있으면 기존 기본값 사용
    final_study_desc = study_description if study_description else "AutoUploaded Study"

    # ASCII로 변환 (한글 제거)
    safe_patient_name = to_ascii_safe(patient_name, patient_id or "Unknown")
    safe_study_desc = to_ascii_safe(final_study_desc, "AutoUploaded Study")

    for idx, (f, sp) in enumerate(zip(files, series_paths), start=1):
        try:
            ds = pydicom.dcmread(f, force=True)

            # Patient
            ds.PatientID = patient_id
            ds.PatientName = safe_patient_name  # ASCII만 사용

            # Study (통합)
            ds.StudyInstanceUID = study_uid
            ds.StudyID = study_id

            # ✅ StudyDescription도 ASCII만 사용
            ds.StudyDescription = safe_study_desc

            # Study date/time 기본
            if not getattr(ds, "StudyDate", None):
                ds.StudyDate = def_date
            if not getattr(ds, "StudyTime", None):
                ds.StudyTime = def_time

            # Series (폴더명 기준 그룹)
            if sp not in series_uid_map:
                series_uid_map[sp] = generate_uid()
                series_num_map[sp] = next_num
                next_num += 1

            ds.SeriesInstanceUID = series_uid_map[sp]
            ds.SeriesNumber = series_num_map[sp]
            ds.SeriesDescription = sp

            # InstanceNumber (없으면 부여)
            if not getattr(ds, "InstanceNumber", None):
                ds.InstanceNumber = idx

            bio = io.BytesIO()
            ds.save_as(bio)
            bio.seek(0)

            resp = _post_instance(bio.getvalue())
            if isinstance(resp, dict):
                ps = resp.get("ParentSeries")
                if ps:
                    uploaded_series.add(ps)

            uploaded += 1

        except Exception as e:
            logger.warning("upload failed %s: %s", getattr(f, "name", "?"), e)
            errors.append(getattr(f, "name", f"index-{idx}"))

    # Orthanc Internal Study ID 조회 (첫 번째 시리즈에서 ParentStudy 가져오기)
    orthanc_study_id = None
    if uploaded_series:
        try:
            first_series_id = list(uploaded_series)[0]
            series_info = _get(f"/series/{first_series_id}")
            orthanc_study_id = series_info.get("ParentStudy")
        except Exception as e:
            logger.warning("Failed to get ParentStudy: %s", e)

    resp_data = {
        "patientId": patient_id,
        "studyUid": study_uid,
        "studyId": study_id,  # DICOM StudyID (UUID)
        "orthancStudyId": orthanc_study_id,  # Orthanc Internal Study ID (NEW)
        "studyDescription": final_study_desc,
        "ocsId": ocs_id if ocs_id else None,  # OCS 연동 정보
        "uploaded": uploaded,
        "failedFiles": errors,
        "orthancSeriesIds": list(uploaded_series),
    }

    dlog("upload_patient result", resp_data)
    return Response(resp_data, status=201)


@api_view(["DELETE"])
def delete_instance(request, instance_id: str):
    try:
        meta = _get(f"/instances/{instance_id}")
        series_id = meta.get("ParentSeries")
        study_id = meta.get("ParentStudy")
        patient_id = meta.get("ParentPatient")

        _delete(f"/instances/{instance_id}")

        try:
            series = _get(f"/series/{series_id}")
            if not series.get("Instances", []):
                _delete(f"/series/{series_id}")
                _auto_cleanup_if_empty(patient_id, study_id)
        except Exception:
            pass

        data = {"deleted": True, "instance_id": instance_id}
        dlog("delete_instance result", data)
        return Response(data)

    except Exception as e:
        logger.exception("delete_instance error")
        data = {"detail": str(e)}
        dlog("delete_instance error", data)
        return Response(data, status=500)


@api_view(["DELETE"])
def delete_series(request, series_id: str):
    try:
        ser = _get(f"/series/{series_id}")
        study_id = ser.get("ParentStudy")
        patient_id = ser.get("ParentPatient")

        _delete(f"/series/{series_id}")
        _auto_cleanup_if_empty(patient_id, study_id)

        data = {"deleted": True, "series_id": series_id}
        dlog("delete_series result", data)
        return Response(data)

    except Exception as e:
        logger.exception("delete_series error")
        data = {"detail": str(e)}
        dlog("delete_series error", data)
        return Response(data, status=500)


@api_view(["DELETE"])
def delete_study(request, study_id: str):
    try:
        stu = _get(f"/studies/{study_id}")
        patient_id = stu.get("ParentPatient")

        _delete(f"/studies/{study_id}")
        _auto_cleanup_if_empty(patient_id)

        data = {"deleted": True, "study_id": study_id}
        dlog("delete_study result", data)
        return Response(data)

    except Exception as e:
        logger.exception("delete_study error")
        data = {"detail": str(e)}
        dlog("delete_study error", data)
        return Response(data, status=500)


@api_view(["DELETE"])
def delete_patient(request, patient_id: str):
    try:
        _delete(f"/patients/{patient_id}")
        data = {"deleted": True, "patient_id": patient_id}
        dlog("delete_patient result", data)
        return Response(data)
    except Exception as e:
        logger.exception("delete_patient error")
        data = {"detail": str(e)}
        dlog("delete_patient error", data)
        return Response(data, status=500)


# -------------------------------------------------------------
# 7) 썸네일 API - DICOM 이미지 미리보기
#    - Series의 중간 슬라이스 이미지를 PNG로 반환
#    - 4개 채널 (T1, T1CE, T2, FLAIR) 썸네일 지원
# -------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def get_series_thumbnail(request, series_id: str):
    """
    시리즈의 중간 슬라이스 썸네일 이미지 반환

    Orthanc의 preview 기능을 활용하여 DICOM 이미지를 PNG로 변환
    슬라이스 위치(SliceLocation 또는 InstanceNumber)를 기준으로 정렬하여 일관된 중간 슬라이스 선택
    """
    try:
        # 시리즈 정보 조회
        series_info = _get(f"/series/{series_id}")
        instances = series_info.get("Instances", [])

        if not instances:
            return Response({"detail": "No instances in series"}, status=404)

        # 각 인스턴스의 슬라이스 위치 정보 수집
        instance_positions = []
        for inst_id in instances:
            try:
                # Orthanc simplified-tags에서 슬라이스 정보 가져오기
                tags = _get(f"/instances/{inst_id}/simplified-tags")

                # SliceLocation이 가장 정확, 없으면 InstanceNumber 사용
                slice_loc = tags.get("SliceLocation")
                instance_num = tags.get("InstanceNumber")

                # 정렬 기준 값 결정
                if slice_loc is not None:
                    try:
                        position = float(slice_loc)
                    except (ValueError, TypeError):
                        position = None
                else:
                    position = None

                # SliceLocation이 없으면 InstanceNumber 사용
                if position is None and instance_num is not None:
                    try:
                        position = float(instance_num)
                    except (ValueError, TypeError):
                        position = None

                instance_positions.append({
                    "id": inst_id,
                    "position": position if position is not None else 0
                })
            except Exception as e:
                # 개별 인스턴스 조회 실패 시 기본값 사용
                logger.warning(f"Failed to get tags for instance {inst_id}: {e}")
                instance_positions.append({"id": inst_id, "position": 0})

        # 슬라이스 위치로 정렬
        instance_positions.sort(key=lambda x: x["position"])

        # 정렬된 목록에서 중간 슬라이스 선택
        middle_idx = len(instance_positions) // 2
        middle_instance_id = instance_positions[middle_idx]["id"]

        # Orthanc의 preview 기능 사용 (PNG 반환)
        preview_url = f"{ORTHANC}/instances/{middle_instance_id}/preview"
        r = requests.get(preview_url, timeout=10)
        r.raise_for_status()

        return HttpResponse(r.content, content_type="image/png")

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            return Response({"detail": "Series not found"}, status=404)
        raise
    except Exception as e:
        logger.exception("get_series_thumbnail error")
        return Response({"detail": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_study_thumbnails(request, study_id: str):
    """
    스터디의 모든 시리즈에 대한 썸네일 정보 반환

    MRI 4채널 (T1, T1CE, T2, FLAIR)에 대한 썸네일 URL 목록 제공
    """
    try:
        study_info = _get(f"/studies/{study_id}")
        series_ids = study_info.get("Series", [])

        thumbnails = []
        for ser_id in series_ids:
            try:
                ser = _get(f"/series/{ser_id}")
                tags = ser.get("MainDicomTags", {}) or {}
                series_desc = tags.get("SeriesDescription", "")
                series_type = _parse_series_type(series_desc)

                # SEG는 썸네일에서 제외 (마스크 이미지)
                if series_type == "SEG":
                    continue

                instances = ser.get("Instances", [])
                if not instances:
                    continue

                thumbnails.append({
                    "series_id": ser_id,
                    "series_type": series_type,
                    "description": series_desc,
                    "instances_count": len(instances),
                    "thumbnail_url": f"/api/orthanc/series/{ser_id}/thumbnail/",
                })
            except Exception as e:
                logger.warning("series thumbnail failed %s: %s", ser_id, e)

        # 채널 순서 정렬: T1 -> T1C -> T2 -> FLAIR -> OTHER
        channel_order = {"T1": 0, "T1C": 1, "T2": 2, "FLAIR": 3, "DWI": 4, "SWI": 5, "OTHER": 6}
        thumbnails.sort(key=lambda x: channel_order.get(x["series_type"], 99))

        return Response({
            "study_id": study_id,
            "count": len(thumbnails),
            "thumbnails": thumbnails
        })

    except Exception as e:
        logger.exception("get_study_thumbnails error")
        return Response({"detail": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_instance_preview(request, instance_id: str):
    """
    특정 인스턴스의 미리보기 이미지 반환 (PNG)
    """
    try:
        preview_url = f"{ORTHANC}/instances/{instance_id}/preview"
        r = requests.get(preview_url, timeout=10)
        r.raise_for_status()

        return HttpResponse(r.content, content_type="image/png")

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            return Response({"detail": "Instance not found"}, status=404)
        raise
    except Exception as e:
        logger.exception("get_instance_preview error")
        return Response({"detail": str(e)}, status=500)
