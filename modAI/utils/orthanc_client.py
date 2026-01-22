"""
Orthanc DICOM Client

Orthanc 서버에서 DICOM 데이터를 fetch하는 클라이언트
"""
import logging
import zipfile
import io
import asyncio
from typing import Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor
import httpx

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import settings

logger = logging.getLogger(__name__)


class OrthancClient:
    """Orthanc DICOM 서버 클라이언트"""

    # 모달리티 식별 키워드
    MODALITY_KEYWORDS = {
        "T1": ["t1", "t1w", "t1-"],
        "T1CE": ["t1ce", "t1c", "t1gd", "t1_ce", "t1-ce", "contrast", "gad", "+c"],
        "T2": ["t2", "t2w", "t2-"],
        "FLAIR": ["flair", "fl", "t2flair", "t2_flair"]
    }

    # 제외할 시리즈 (segmentation mask 등 - 추론 시 사용하지 않음)
    SKIP_KEYWORDS = ["seg", "segmentation", "mask", "label"]

    def __init__(
        self,
        base_url: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
    ):
        self.base_url = base_url or settings.ORTHANC_URL
        self.auth = (
            username or settings.ORTHANC_USER,
            password or settings.ORTHANC_PASSWORD,
        )

    def _get(self, path: str) -> httpx.Response:
        """GET 요청"""
        url = f"{self.base_url}{path}"
        response = httpx.get(url, auth=self.auth, timeout=60.0)
        response.raise_for_status()
        return response

    def _post(self, path: str, data: str = None, json_data: dict = None) -> httpx.Response:
        """POST 요청"""
        url = f"{self.base_url}{path}"
        response = httpx.post(url, auth=self.auth, content=data, json=json_data, timeout=60.0)
        response.raise_for_status()
        return response

    def _identify_modality(self, series_description: str) -> Optional[str]:
        """
        Series description에서 모달리티 식별

        Args:
            series_description: DICOM SeriesDescription 태그 값

        Returns:
            모달리티 이름 (T1, T1CE, T2, FLAIR) 또는 None
        """
        desc_lower = series_description.lower()

        # seg 등 제외할 시리즈 먼저 확인
        for kw in self.SKIP_KEYWORDS:
            if kw in desc_lower:
                logger.info(f"Skipping series (matched '{kw}'): {series_description}")
                return None

        # T1CE를 먼저 확인 (T1이 포함되어 있으므로)
        for kw in self.MODALITY_KEYWORDS["T1CE"]:
            if kw in desc_lower:
                return "T1CE"

        # 나머지 모달리티 확인
        for mod in ["T1", "T2", "FLAIR"]:
            for kw in self.MODALITY_KEYWORDS[mod]:
                if kw in desc_lower:
                    return mod

        return None

    def fetch_study_series(self, study_uid: str) -> List[Dict]:
        """
        Study의 모든 Series 정보 조회

        Args:
            study_uid: DICOM Study UID 또는 Orthanc Study ID

        Returns:
            Series 정보 리스트
        """
        # Study ID로 조회 시도
        try:
            response = self._get(f"/studies/{study_uid}/series")
            return response.json()
        except httpx.HTTPStatusError:
            pass

        # Study UID로 검색 (POST 요청)
        response = self._post("/tools/lookup", data=study_uid)
        lookup_result = response.json()

        if not lookup_result:
            raise ValueError(f"Study not found: {study_uid}")

        study_id = lookup_result[0]['ID']
        response = self._get(f"/studies/{study_id}/series")
        return response.json()

    def fetch_study_dicom_bytes(
        self,
        study_uid: str,
        series_ids: Optional[List[str]] = None,
    ) -> Dict[str, List[bytes]]:
        """
        Study에서 DICOM 바이트 데이터 fetch

        Args:
            study_uid: DICOM Study UID 또는 Orthanc Study ID
            series_ids: 특정 Series ID 목록 (없으면 모든 Series에서 자동 식별)

        Returns:
            {'T1': [bytes], 'T1CE': [bytes], 'T2': [bytes], 'FLAIR': [bytes]}
        """
        print(f"[OrthancClient] Fetching DICOM for study: {study_uid}")
        print(f"[OrthancClient] Orthanc URL: {self.base_url}")

        dicom_data = {"T1": [], "T1CE": [], "T2": [], "FLAIR": []}

        if series_ids:
            # 지정된 Series에서 fetch
            print(f"[OrthancClient] Using provided series IDs: {series_ids}")
            for series_id in series_ids:
                self._fetch_series_data(series_id, dicom_data)
        else:
            # Study의 모든 Series에서 자동 식별
            print("[OrthancClient] Auto-detecting series from study...")
            series_list = self.fetch_study_series(study_uid)
            print(f"[OrthancClient] Found {len(series_list)} series in study")

            for i, series_info in enumerate(series_list):
                series_id = series_info if isinstance(series_info, str) else series_info.get('ID')
                print(f"[OrthancClient] Processing series {i+1}/{len(series_list)}: {series_id}")
                if series_id:
                    self._fetch_series_data(series_id, dicom_data)

        # 결과 확인
        print("[OrthancClient] DICOM fetch results:")
        for mod, data in dicom_data.items():
            print(f"  - {mod}: {len(data)} slices")

        return dicom_data

    def _fetch_series_data(
        self,
        series_id: str,
        dicom_data: Dict[str, List[bytes]]
    ) -> None:
        """
        단일 Series의 DICOM 데이터 fetch

        Args:
            series_id: Orthanc Series ID
            dicom_data: 결과를 저장할 dict (수정됨)
        """
        try:
            # Series 정보 조회
            response = self._get(f"/series/{series_id}")
            series_info = response.json()

            # Series Description에서 모달리티 식별
            main_tags = series_info.get("MainDicomTags", {})
            desc = main_tags.get("SeriesDescription", "")
            print(f"    Series {series_id}: '{desc}'")

            modality = self._identify_modality(desc)
            if not modality:
                print(f"    -> Skipped (unknown modality)")
                return

            # 이미 해당 모달리티 데이터가 있으면 skip
            if dicom_data[modality]:
                print(f"    -> Skipped (duplicate {modality})")
                return

            # Instance들의 DICOM 데이터 fetch
            instances = series_info.get("Instances", [])
            print(f"    -> Identified as {modality}, fetching {len(instances)} instances...")

            for instance_id in instances:
                dcm_response = self._get(f"/instances/{instance_id}/file")
                dicom_data[modality].append(dcm_response.content)

            print(f"    -> Fetched {len(instances)} slices for {modality}")

        except httpx.HTTPStatusError as e:
            print(f"    -> ERROR: Failed to fetch series {series_id}: {str(e)}")

    def get_series_info(self, series_id: str) -> Dict:
        """Series 상세 정보 조회"""
        response = self._get(f"/series/{series_id}")
        return response.json()

    def get_instance_dicom(self, instance_id: str) -> bytes:
        """단일 Instance의 DICOM 파일 조회"""
        response = self._get(f"/instances/{instance_id}/file")
        return response.content

    def health_check(self) -> bool:
        """Orthanc 서버 연결 확인"""
        try:
            response = self._get("/system")
            return response.status_code == 200
        except Exception:
            return False

    def fetch_segmentation_series(
        self,
        study_uid: str,
    ) -> Optional[List[bytes]]:
        """
        Study에서 Segmentation (Ground Truth) 시리즈 fetch

        SEG 또는 segmentation, mask, label 키워드가 포함된 시리즈를 찾아
        DICOM 바이트 데이터로 반환

        Args:
            study_uid: DICOM Study UID 또는 Orthanc Study ID

        Returns:
            Segmentation DICOM 바이트 리스트 또는 None (없는 경우)
        """
        print(f"[OrthancClient] Searching for segmentation series in study: {study_uid}")

        try:
            series_list = self.fetch_study_series(study_uid)
            print(f"[OrthancClient] Found {len(series_list)} total series")

            for series_info in series_list:
                series_id = series_info if isinstance(series_info, str) else series_info.get('ID')
                if not series_id:
                    continue

                # Series 정보 조회
                response = self._get(f"/series/{series_id}")
                info = response.json()

                main_tags = info.get("MainDicomTags", {})
                desc = main_tags.get("SeriesDescription", "").lower()
                modality = main_tags.get("Modality", "").upper()

                print(f"    Series {series_id}: '{desc}' (Modality: {modality})")

                # SEG 모달리티이거나 segmentation 관련 키워드가 있으면 fetch
                is_seg_modality = modality == "SEG"
                has_seg_keyword = any(kw in desc for kw in ["seg", "segmentation", "mask", "label", "ground", "truth", "gt"])

                if is_seg_modality or has_seg_keyword:
                    print(f"    -> Found segmentation series!")
                    instances = info.get("Instances", [])

                    if not instances:
                        print(f"    -> No instances found, skipping")
                        continue

                    # Instance들의 DICOM 데이터 fetch
                    seg_bytes = []
                    for instance_id in instances:
                        dcm_response = self._get(f"/instances/{instance_id}/file")
                        seg_bytes.append(dcm_response.content)

                    print(f"    -> Fetched {len(seg_bytes)} segmentation slices")
                    return seg_bytes

            print("[OrthancClient] No segmentation series found in study")
            return None

        except Exception as e:
            print(f"[OrthancClient] Error fetching segmentation: {str(e)}")
            return None

    # ========================================================================
    # 최적화된 DICOM Fetch 메서드 (Archive API 사용)
    # ========================================================================

    def fetch_study_dicom_bytes_fast(
        self,
        study_uid: str,
        series_ids: Optional[List[str]] = None,
    ) -> Dict[str, List[bytes]]:
        """
        Study에서 DICOM 바이트 데이터 fetch (최적화 버전)

        Orthanc Archive API를 사용하여 Series 전체를 ZIP으로 한번에 다운로드
        620개 요청 → 4개 요청으로 감소

        Args:
            study_uid: DICOM Study UID 또는 Orthanc Study ID
            series_ids: 특정 Series ID 목록 (없으면 모든 Series에서 자동 식별)

        Returns:
            {'T1': [bytes], 'T1CE': [bytes], 'T2': [bytes], 'FLAIR': [bytes]}
        """
        import time
        start_time = time.time()

        print(f"[OrthancClient] Fetching DICOM (FAST mode) for study: {study_uid}")
        print(f"[OrthancClient] Orthanc URL: {self.base_url}")

        dicom_data = {"T1": [], "T1CE": [], "T2": [], "FLAIR": []}
        series_to_fetch = []  # (series_id, modality) 튜플 리스트

        if series_ids:
            print(f"[OrthancClient] Using provided series IDs: {series_ids}")
            for series_id in series_ids:
                series_info = self._get(f"/series/{series_id}").json()
                main_tags = series_info.get("MainDicomTags", {})
                desc = main_tags.get("SeriesDescription", "")
                modality = self._identify_modality(desc)
                if modality and not dicom_data[modality]:
                    series_to_fetch.append((series_id, modality))
        else:
            print("[OrthancClient] Auto-detecting series from study...")
            series_list = self.fetch_study_series(study_uid)
            print(f"[OrthancClient] Found {len(series_list)} series in study")

            for series_info in series_list:
                series_id = series_info if isinstance(series_info, str) else series_info.get('ID')
                if not series_id:
                    continue

                info = self._get(f"/series/{series_id}").json()
                main_tags = info.get("MainDicomTags", {})
                desc = main_tags.get("SeriesDescription", "")
                print(f"    Series {series_id}: '{desc}'")

                modality = self._identify_modality(desc)
                if modality and not dicom_data[modality]:
                    instance_count = len(info.get("Instances", []))
                    series_to_fetch.append((series_id, modality, instance_count))
                    print(f"    -> Will fetch as {modality} ({instance_count} instances)")
                else:
                    print(f"    -> Skipped")

        # 병렬로 Series Archive 다운로드
        print(f"\n[OrthancClient] Downloading {len(series_to_fetch)} series using Archive API...")

        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {}
            for item in series_to_fetch:
                series_id = item[0]
                modality = item[1]
                future = executor.submit(self._fetch_series_archive, series_id)
                futures[future] = modality

            for future in futures:
                modality = futures[future]
                try:
                    dcm_bytes_list = future.result()
                    dicom_data[modality] = dcm_bytes_list
                    print(f"    -> {modality}: {len(dcm_bytes_list)} slices fetched")
                except Exception as e:
                    print(f"    -> {modality}: ERROR - {str(e)}")

        elapsed = time.time() - start_time
        print(f"\n[OrthancClient] DICOM fetch completed in {elapsed:.2f}s")
        for mod, data in dicom_data.items():
            print(f"  - {mod}: {len(data)} slices")

        return dicom_data

    def _fetch_series_archive(self, series_id: str) -> List[bytes]:
        """
        Series 전체를 ZIP Archive로 다운로드 후 개별 DICOM bytes로 반환

        Args:
            series_id: Orthanc Series ID

        Returns:
            DICOM 파일 bytes 리스트
        """
        # Archive 다운로드 (ZIP)
        url = f"{self.base_url}/series/{series_id}/archive"
        response = httpx.get(url, auth=self.auth, timeout=120.0)
        response.raise_for_status()

        # ZIP에서 DICOM 파일 추출
        dcm_bytes_list = []
        with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
            for name in zf.namelist():
                if name.endswith('.dcm') or not '.' in name.split('/')[-1]:
                    dcm_bytes_list.append(zf.read(name))

        return dcm_bytes_list
