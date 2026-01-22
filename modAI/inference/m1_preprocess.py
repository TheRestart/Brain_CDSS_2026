"""
M1 Preprocessing Script

Colab 학습과 동일한 전처리를 수행하여 일관된 결과 보장
- Input: 4채널 MRI NIfTI (T1, T1ce, T2, FLAIR)
- Output: 전처리된 tensor (.pt)

전처리 단계:
1. LoadImage: NIfTI → numpy
2. Orientation: RAS 방향 통일
3. Spacing: 1mm isotropic
4. CropForeground: 공통 bbox 적용
5. Resize: 128×128×128
6. Normalize: 각 채널별 독립적 0-1 정규화

Usage:
    # 단일 환자 (폴더)
    python m1_preprocess.py -i /path/to/BraTS2021_00000 -o output.pt

    # 개별 파일 지정
    python m1_preprocess.py --t1 t1.nii.gz --t1ce t1ce.nii.gz --t2 t2.nii.gz --flair flair.nii.gz -o output.pt
"""

import os
import sys
import io
import argparse
import time
from pathlib import Path
from typing import Optional, Tuple, Union, List, Dict

import torch
import numpy as np


# ============================================================
# Timer Utility
# ============================================================

class Timer:
    """단계별 시간 측정 유틸리티"""

    def __init__(self, name: str = "Process", verbose: bool = True):
        self.name = name
        self.verbose = verbose
        self.steps = []
        self.start_time = None
        self.step_start = None

    def start(self):
        """전체 타이머 시작"""
        self.start_time = time.time()
        self.step_start = self.start_time
        if self.verbose:
            print(f"\n[Timer] {self.name} started")
        return self

    def step(self, step_name: str):
        """단계 완료 및 다음 단계 시작"""
        now = time.time()
        elapsed = now - self.step_start
        self.steps.append((step_name, elapsed))
        if self.verbose:
            print(f"  [{elapsed:.3f}s] {step_name}")
        self.step_start = now
        return elapsed

    def total(self) -> float:
        """전체 소요 시간"""
        return time.time() - self.start_time if self.start_time else 0

    def summary(self) -> dict:
        """타이밍 요약"""
        total = self.total()
        result = {
            "total_seconds": total,
            "steps": {name: round(t, 4) for name, t in self.steps}
        }
        if self.verbose:
            print(f"  [TOTAL: {total:.3f}s] {self.name} completed")
        return result

# DICOM support
try:
    import pydicom
    PYDICOM_AVAILABLE = True
except ImportError:
    PYDICOM_AVAILABLE = False

# MONAI imports
try:
    from monai.transforms import (
        Compose, LoadImage, EnsureChannelFirst, Orientation, Spacing, Resize
    )
    MONAI_AVAILABLE = True
except ImportError:
    MONAI_AVAILABLE = False
    print("Warning: MONAI not installed. Using basic preprocessing.")


# ============================================================
# Configuration
# ============================================================
TARGET_SIZE = (128, 128, 128)
TARGET_SPACING = (1.0, 1.0, 1.0)


# ============================================================
# Preprocessing Functions
# ============================================================

def load_and_orient_monai(file_path: str, is_label: bool = False) -> torch.Tensor:
    """MONAI를 사용한 파일 로드 및 방향 통일"""
    transform = Compose([
        LoadImage(image_only=True),
        EnsureChannelFirst(),
        Orientation(axcodes='RAS'),
        Spacing(pixdim=TARGET_SPACING, mode='nearest' if is_label else 'bilinear'),
    ])
    return transform(str(file_path))


def load_and_orient_basic(file_path: str) -> torch.Tensor:
    """기본 NIfTI 로드 (MONAI 없이)"""
    import nibabel as nib

    nii = nib.load(str(file_path))
    data = nii.get_fdata().astype(np.float32)

    # Add channel dimension
    if data.ndim == 3:
        data = data[np.newaxis, ...]

    return torch.from_numpy(data)


def get_foreground_bbox(image_4ch: torch.Tensor, margin: int = 5) -> Optional[Tuple]:
    """4채널 이미지에서 foreground bounding box 계산"""
    combined = image_4ch.sum(dim=0)
    threshold = combined.mean() * 0.1
    fg_mask = combined > threshold

    coords = torch.where(fg_mask)
    if len(coords[0]) == 0:
        return None

    d_min, d_max = coords[0].min().item(), coords[0].max().item()
    h_min, h_max = coords[1].min().item(), coords[1].max().item()
    w_min, w_max = coords[2].min().item(), coords[2].max().item()

    shape = combined.shape
    d_min = max(0, d_min - margin)
    d_max = min(shape[0] - 1, d_max + margin)
    h_min = max(0, h_min - margin)
    h_max = min(shape[1] - 1, h_max + margin)
    w_min = max(0, w_min - margin)
    w_max = min(shape[2] - 1, w_max + margin)

    return (d_min, d_max + 1, h_min, h_max + 1, w_min, w_max + 1)


def apply_crop_and_resize(
    tensor: torch.Tensor,
    bbox: Optional[Tuple],
    target_size: Tuple[int, int, int],
    mode: str = 'trilinear'
) -> torch.Tensor:
    """bbox로 crop 후 target_size로 resize"""
    if bbox is not None:
        d_min, d_max, h_min, h_max, w_min, w_max = bbox
        tensor = tensor[:, d_min:d_max, h_min:h_max, w_min:w_max]

    if MONAI_AVAILABLE:
        resize_transform = Resize(spatial_size=target_size, mode=mode)
        return resize_transform(tensor)
    else:
        # Basic resize using torch
        tensor = tensor.unsqueeze(0)  # Add batch dim
        tensor = torch.nn.functional.interpolate(
            tensor, size=target_size, mode=mode, align_corners=False
        )
        return tensor.squeeze(0)


def normalize_channel(tensor: torch.Tensor) -> torch.Tensor:
    """단일 채널 정규화 (0-1)"""
    min_val = tensor.min()
    max_val = tensor.max()
    if max_val - min_val > 1e-8:
        return (tensor - min_val) / (max_val - min_val)
    else:
        return torch.zeros_like(tensor)


def normalize_channels_separately(image_4ch: torch.Tensor) -> torch.Tensor:
    """4채널 이미지의 각 채널을 독립적으로 정규화"""
    normalized = torch.zeros_like(image_4ch)
    for i in range(4):
        normalized[i] = normalize_channel(image_4ch[i])
    return normalized


def convert_brats_labels(label_tensor: torch.Tensor) -> torch.Tensor:
    """BraTS labels (0,1,2,4) → (0,1,2,3)"""
    label = label_tensor.clone()
    label[label == 4] = 3
    return label


# ============================================================
# DICOM Processing Functions
# ============================================================

def load_dicom_series(dicom_files: List[str]) -> Tuple[np.ndarray, Tuple[float, float, float]]:
    """
    DICOM 시리즈를 3D numpy 배열로 변환

    Args:
        dicom_files: DICOM 파일 경로 리스트

    Returns:
        volume: 3D numpy array (H, W, D)
        spacing: (row_spacing, col_spacing, slice_spacing)
    """
    if not PYDICOM_AVAILABLE:
        raise ImportError("pydicom is required for DICOM processing")

    # Load all slices
    slices = []
    for f in dicom_files:
        ds = pydicom.dcmread(f)
        slices.append(ds)

    # Sort by SliceLocation or InstanceNumber
    try:
        slices.sort(key=lambda x: float(x.SliceLocation))
    except AttributeError:
        slices.sort(key=lambda x: int(x.InstanceNumber))

    # Extract pixel arrays
    pixel_arrays = [s.pixel_array.astype(np.float32) for s in slices]
    volume = np.stack(pixel_arrays, axis=-1)  # (H, W, D)

    # Get spacing
    ds = slices[0]
    pixel_spacing = ds.PixelSpacing if hasattr(ds, 'PixelSpacing') else [1.0, 1.0]
    slice_thickness = ds.SliceThickness if hasattr(ds, 'SliceThickness') else 1.0

    # Calculate actual slice spacing from SliceLocation if available
    if len(slices) > 1 and hasattr(slices[0], 'SliceLocation'):
        slice_spacing = abs(float(slices[1].SliceLocation) - float(slices[0].SliceLocation))
    else:
        slice_spacing = float(slice_thickness)

    spacing = (float(pixel_spacing[0]), float(pixel_spacing[1]), slice_spacing)

    return volume, spacing


def load_dicom_from_bytes(dicom_bytes_list: List[bytes]) -> Tuple[np.ndarray, Tuple[float, float, float]]:
    """
    DICOM 바이트 데이터를 3D numpy 배열로 변환 (Orthanc에서 직접 받을 때 사용)

    Args:
        dicom_bytes_list: DICOM 바이트 데이터 리스트

    Returns:
        volume: 3D numpy array (H, W, D)
        spacing: (row_spacing, col_spacing, slice_spacing)
    """
    if not PYDICOM_AVAILABLE:
        raise ImportError("pydicom is required for DICOM processing")

    # Load all slices from bytes
    slices = []
    for dcm_bytes in dicom_bytes_list:
        ds = pydicom.dcmread(io.BytesIO(dcm_bytes))
        slices.append(ds)

    # Sort by SliceLocation or InstanceNumber
    try:
        slices.sort(key=lambda x: float(x.SliceLocation))
    except AttributeError:
        slices.sort(key=lambda x: int(x.InstanceNumber))

    # Extract pixel arrays
    pixel_arrays = [s.pixel_array.astype(np.float32) for s in slices]
    volume = np.stack(pixel_arrays, axis=-1)  # (H, W, D)

    # Get spacing
    ds = slices[0]
    pixel_spacing = ds.PixelSpacing if hasattr(ds, 'PixelSpacing') else [1.0, 1.0]
    slice_thickness = ds.SliceThickness if hasattr(ds, 'SliceThickness') else 1.0

    if len(slices) > 1 and hasattr(slices[0], 'SliceLocation'):
        slice_spacing = abs(float(slices[1].SliceLocation) - float(slices[0].SliceLocation))
    else:
        slice_spacing = float(slice_thickness)

    spacing = (float(pixel_spacing[0]), float(pixel_spacing[1]), slice_spacing)

    return volume, spacing


def resample_volume(
    volume: np.ndarray,
    current_spacing: Tuple[float, float, float],
    target_spacing: Tuple[float, float, float] = (1.0, 1.0, 1.0)
) -> np.ndarray:
    """
    볼륨을 target spacing으로 리샘플링

    Args:
        volume: 3D numpy array (H, W, D)
        current_spacing: 현재 spacing (row, col, slice)
        target_spacing: 목표 spacing

    Returns:
        리샘플링된 볼륨
    """
    from scipy.ndimage import zoom

    # Calculate zoom factors
    zoom_factors = [
        current_spacing[0] / target_spacing[0],
        current_spacing[1] / target_spacing[1],
        current_spacing[2] / target_spacing[2]
    ]

    # Resample
    resampled = zoom(volume, zoom_factors, order=1)
    return resampled


# ============================================================
# Main Preprocessing Classes
# ============================================================

class M1Preprocessor:
    """M1 모델용 전처리 클래스"""

    def __init__(
        self,
        target_size: Tuple[int, int, int] = TARGET_SIZE,
        target_spacing: Tuple[float, float, float] = TARGET_SPACING,
    ):
        self.target_size = target_size
        self.target_spacing = target_spacing
        self.use_monai = MONAI_AVAILABLE

        if not self.use_monai:
            print("Warning: Using basic preprocessing (MONAI not available)")

    def load_modality(self, file_path: str, is_label: bool = False) -> torch.Tensor:
        """단일 모달리티 로드"""
        if self.use_monai:
            return load_and_orient_monai(file_path, is_label)
        else:
            return load_and_orient_basic(file_path)

    def preprocess_from_files(
        self,
        t1_path: str,
        t1ce_path: str,
        t2_path: str,
        flair_path: str,
        seg_path: Optional[str] = None,
        patient_id: Optional[str] = None,
    ) -> dict:
        """개별 파일에서 전처리"""
        # Load all modalities
        t1_img = self.load_modality(t1_path)
        t1ce_img = self.load_modality(t1ce_path)
        t2_img = self.load_modality(t2_path)
        flair_img = self.load_modality(flair_path)

        # Stack to 4-channel
        image_4ch = torch.cat([t1_img, t1ce_img, t2_img, flair_img], dim=0)

        # Get foreground bbox
        bbox = get_foreground_bbox(image_4ch, margin=5)

        # Crop and resize
        image_tensor = apply_crop_and_resize(
            image_4ch, bbox, self.target_size, mode='trilinear'
        )

        # Normalize each channel separately
        image_tensor = normalize_channels_separately(image_tensor)
        image_tensor = image_tensor.float()

        result = {
            'image': image_tensor,
            'label': None,
            'patient_id': patient_id or 'unknown',
            'dataset': 'custom',
            'normalization': 'per_channel',
        }

        # Process segmentation if provided
        if seg_path and Path(seg_path).exists():
            label_img = self.load_modality(seg_path, is_label=True)
            label_tensor = apply_crop_and_resize(
                label_img, bbox, self.target_size, mode='nearest'
            )
            label_tensor = convert_brats_labels(label_tensor.long())
            result['label'] = label_tensor

        return result

    def preprocess_from_folder(
        self,
        folder_path: str,
        dataset_type: str = 'auto'
    ) -> dict:
        """폴더에서 자동으로 파일 찾아 전처리"""
        folder = Path(folder_path)
        patient_id = folder.name

        # Auto-detect dataset type
        if dataset_type == 'auto':
            if 'BraTS' in patient_id:
                dataset_type = 'brats'
            elif 'UCSF' in patient_id:
                dataset_type = 'ucsf'
            else:
                dataset_type = 'brats'  # Default

        # Find files based on dataset type
        if dataset_type == 'brats':
            t1_files = list(folder.glob('*_t1.nii.gz'))
            t1ce_files = list(folder.glob('*_t1ce.nii.gz'))
            t2_files = list(folder.glob('*_t2.nii.gz'))
            flair_files = list(folder.glob('*_flair.nii.gz'))
            seg_files = list(folder.glob('*_seg.nii.gz'))
        else:  # UCSF or similar
            t1_files = list(folder.glob('*T1.nii.gz')) or list(folder.glob('*_T1.nii.gz'))
            t1ce_files = list(folder.glob('*T1c*.nii.gz')) or list(folder.glob('*_T1c.nii.gz'))
            t2_files = list(folder.glob('*T2.nii.gz')) or list(folder.glob('*_T2.nii.gz'))
            flair_files = list(folder.glob('*FLAIR.nii.gz')) or list(folder.glob('*_FLAIR.nii.gz'))
            seg_files = []

        # Validate
        if not all([t1_files, t1ce_files, t2_files, flair_files]):
            missing = []
            if not t1_files: missing.append('T1')
            if not t1ce_files: missing.append('T1ce')
            if not t2_files: missing.append('T2')
            if not flair_files: missing.append('FLAIR')
            raise FileNotFoundError(f"Missing modalities: {missing}")

        result = self.preprocess_from_files(
            t1_path=str(t1_files[0]),
            t1ce_path=str(t1ce_files[0]),
            t2_path=str(t2_files[0]),
            flair_path=str(flair_files[0]),
            seg_path=str(seg_files[0]) if seg_files else None,
            patient_id=patient_id,
        )

        result['dataset'] = 'BraTS2021' if dataset_type == 'brats' else 'UCSF-PDGM'
        return result

    def preprocess_and_save(
        self,
        input_path: str,
        output_path: str,
        **kwargs
    ) -> bool:
        """전처리 후 저장"""
        try:
            input_path = Path(input_path)

            if input_path.is_dir():
                result = self.preprocess_from_folder(str(input_path), **kwargs)
            else:
                raise ValueError("For single files, use preprocess_from_files()")

            torch.save(result, output_path)
            return True

        except Exception as e:
            print(f"Error preprocessing {input_path}: {e}")
            return False

    # ============================================================
    # DICOM Processing Methods
    # ============================================================

    def preprocess_from_dicom_files(
        self,
        t1_files: List[str],
        t1ce_files: List[str],
        t2_files: List[str],
        flair_files: List[str],
        patient_id: Optional[str] = None,
        verbose: bool = True,
    ) -> dict:
        """
        DICOM 파일 리스트에서 전처리 (파일 경로 사용)

        Args:
            t1_files: T1 DICOM 파일 경로 리스트
            t1ce_files: T1CE DICOM 파일 경로 리스트
            t2_files: T2 DICOM 파일 경로 리스트
            flair_files: FLAIR DICOM 파일 경로 리스트
            patient_id: 환자 ID
            verbose: 타이밍 정보 출력 여부

        Returns:
            전처리된 데이터 dict
        """
        if not PYDICOM_AVAILABLE:
            raise ImportError("pydicom is required for DICOM processing")

        timer = Timer(name="DICOM Preprocessing (files)", verbose=verbose)
        timer.start()

        # Load each modality
        t1_vol, t1_spacing = load_dicom_series(t1_files)
        timer.step(f"Load T1 ({len(t1_files)} slices)")

        t1ce_vol, t1ce_spacing = load_dicom_series(t1ce_files)
        timer.step(f"Load T1CE ({len(t1ce_files)} slices)")

        t2_vol, t2_spacing = load_dicom_series(t2_files)
        timer.step(f"Load T2 ({len(t2_files)} slices)")

        flair_vol, flair_spacing = load_dicom_series(flair_files)
        timer.step(f"Load FLAIR ({len(flair_files)} slices)")

        # Use T1 spacing as reference (all should be similar)
        spacing = t1_spacing

        # Resample to 1mm isotropic if needed
        if spacing != self.target_spacing:
            t1_vol = resample_volume(t1_vol, spacing, self.target_spacing)
            t1ce_vol = resample_volume(t1ce_vol, t1ce_spacing, self.target_spacing)
            t2_vol = resample_volume(t2_vol, t2_spacing, self.target_spacing)
            flair_vol = resample_volume(flair_vol, flair_spacing, self.target_spacing)
            timer.step(f"Resample to 1mm isotropic (from {spacing})")
        else:
            timer.step("Spacing already 1mm (skip resample)")

        # Apply RAS orientation (flip X and Y axes to match NIfTI preprocessing)
        # Original NIfTI has affine with negative X, Y (LPS -> RAS requires flip)
        # DICOM data needs same transformation for consistency
        t1_vol = np.flip(t1_vol, axis=(0, 1)).copy()
        t1ce_vol = np.flip(t1ce_vol, axis=(0, 1)).copy()
        t2_vol = np.flip(t2_vol, axis=(0, 1)).copy()
        flair_vol = np.flip(flair_vol, axis=(0, 1)).copy()
        timer.step("Apply RAS orientation (flip X, Y)")

        # Stack to 4-channel tensor (C, H, W, D) - same as MONAI output format
        # DICOM loads as (H, W, D), keep same order and add channel dim
        t1_tensor = torch.from_numpy(t1_vol).unsqueeze(0)
        t1ce_tensor = torch.from_numpy(t1ce_vol).unsqueeze(0)
        t2_tensor = torch.from_numpy(t2_vol).unsqueeze(0)
        flair_tensor = torch.from_numpy(flair_vol).unsqueeze(0)

        image_4ch = torch.cat([t1_tensor, t1ce_tensor, t2_tensor, flair_tensor], dim=0)
        timer.step(f"Stack 4-channel tensor {tuple(image_4ch.shape)}")

        # Get foreground bbox
        bbox = get_foreground_bbox(image_4ch, margin=5)
        timer.step(f"Calculate foreground bbox: {bbox}")

        # Crop and resize
        image_tensor = apply_crop_and_resize(
            image_4ch, bbox, self.target_size, mode='trilinear'
        )
        timer.step(f"Crop & resize to {self.target_size}")

        # Normalize each channel separately (0-1)
        image_tensor = normalize_channels_separately(image_tensor)
        image_tensor = image_tensor.float()
        timer.step("Per-channel 0-1 normalization")

        timing_summary = timer.summary()

        return {
            'image': image_tensor,
            'label': None,
            'patient_id': patient_id or 'unknown',
            'dataset': 'DICOM',
            'normalization': 'per_channel',
            'timing': timing_summary,
        }

    def preprocess_from_dicom_bytes(
        self,
        t1_bytes: List[bytes],
        t1ce_bytes: List[bytes],
        t2_bytes: List[bytes],
        flair_bytes: List[bytes],
        patient_id: Optional[str] = None,
        verbose: bool = True,
    ) -> dict:
        """
        DICOM 바이트 데이터에서 전처리 (Orthanc API에서 직접 받을 때 사용)

        Args:
            t1_bytes: T1 DICOM 바이트 데이터 리스트
            t1ce_bytes: T1CE DICOM 바이트 데이터 리스트
            t2_bytes: T2 DICOM 바이트 데이터 리스트
            flair_bytes: FLAIR DICOM 바이트 데이터 리스트
            patient_id: 환자 ID
            verbose: 타이밍 정보 출력 여부

        Returns:
            전처리된 데이터 dict
        """
        if not PYDICOM_AVAILABLE:
            raise ImportError("pydicom is required for DICOM processing")

        timer = Timer(name="DICOM Preprocessing (bytes)", verbose=verbose)
        timer.start()

        # Load each modality from bytes
        t1_vol, t1_spacing = load_dicom_from_bytes(t1_bytes)
        timer.step(f"Load T1 ({len(t1_bytes)} slices)")

        t1ce_vol, t1ce_spacing = load_dicom_from_bytes(t1ce_bytes)
        timer.step(f"Load T1CE ({len(t1ce_bytes)} slices)")

        t2_vol, t2_spacing = load_dicom_from_bytes(t2_bytes)
        timer.step(f"Load T2 ({len(t2_bytes)} slices)")

        flair_vol, flair_spacing = load_dicom_from_bytes(flair_bytes)
        timer.step(f"Load FLAIR ({len(flair_bytes)} slices)")

        # Use T1 spacing as reference
        spacing = t1_spacing

        # Resample to 1mm isotropic if needed
        if spacing != self.target_spacing:
            t1_vol = resample_volume(t1_vol, spacing, self.target_spacing)
            t1ce_vol = resample_volume(t1ce_vol, t1ce_spacing, self.target_spacing)
            t2_vol = resample_volume(t2_vol, t2_spacing, self.target_spacing)
            flair_vol = resample_volume(flair_vol, flair_spacing, self.target_spacing)
            timer.step(f"Resample to 1mm isotropic (from {spacing})")
        else:
            timer.step("Spacing already 1mm (skip resample)")

        # Apply RAS orientation (flip X and Y axes to match NIfTI preprocessing)
        # Original NIfTI has affine with negative X, Y (LPS -> RAS requires flip)
        # DICOM data needs same transformation for consistency
        t1_vol = np.flip(t1_vol, axis=(0, 1)).copy()
        t1ce_vol = np.flip(t1ce_vol, axis=(0, 1)).copy()
        t2_vol = np.flip(t2_vol, axis=(0, 1)).copy()
        flair_vol = np.flip(flair_vol, axis=(0, 1)).copy()
        timer.step("Apply RAS orientation (flip X, Y)")

        # Stack to 4-channel tensor (C, H, W, D) - same as MONAI output format
        # DICOM loads as (H, W, D), keep same order and add channel dim
        t1_tensor = torch.from_numpy(t1_vol).unsqueeze(0)
        t1ce_tensor = torch.from_numpy(t1ce_vol).unsqueeze(0)
        t2_tensor = torch.from_numpy(t2_vol).unsqueeze(0)
        flair_tensor = torch.from_numpy(flair_vol).unsqueeze(0)

        image_4ch = torch.cat([t1_tensor, t1ce_tensor, t2_tensor, flair_tensor], dim=0)
        timer.step(f"Stack 4-channel tensor {tuple(image_4ch.shape)}")

        # Get foreground bbox
        bbox = get_foreground_bbox(image_4ch, margin=5)
        timer.step(f"Calculate foreground bbox: {bbox}")

        # Crop and resize
        image_tensor = apply_crop_and_resize(
            image_4ch, bbox, self.target_size, mode='trilinear'
        )
        timer.step(f"Crop & resize to {self.target_size}")

        # Normalize each channel separately (0-1)
        image_tensor = normalize_channels_separately(image_tensor)
        image_tensor = image_tensor.float()
        timer.step("Per-channel 0-1 normalization")

        timing_summary = timer.summary()

        # Calculate slice mapping info for verification
        original_shape = tuple(image_4ch.shape[1:])  # (H, W, D) after RAS flip
        slice_mapping = self._calculate_slice_mapping(
            original_shape=original_shape,
            bbox=bbox,
            target_size=self.target_size
        )

        return {
            'image': image_tensor,
            'label': None,
            'patient_id': patient_id or 'unknown',
            'dataset': 'DICOM',
            'normalization': 'per_channel',
            'timing': timing_summary,
            'bbox': bbox,  # For ground truth alignment
            'original_shape': original_shape,  # (H, W, D)
            'slice_mapping': slice_mapping,  # Detailed mapping info
        }

    def _calculate_slice_mapping(
        self,
        original_shape: Tuple[int, int, int],
        bbox: Optional[Tuple],
        target_size: Tuple[int, int, int]
    ) -> dict:
        """
        Calculate the mapping between original slices and preprocessed slices.

        This helps verify that preprocessing is correct by showing which original
        slice indices correspond to which preprocessed slice indices.

        Args:
            original_shape: Original volume shape (H, W, D) after RAS orientation
            bbox: Bounding box (d_min, d_max, h_min, h_max, w_min, w_max) or None
            target_size: Target size after resize (128, 128, 128)

        Returns:
            Dictionary with slice mapping information
        """
        H, W, D = original_shape

        if bbox is not None:
            d_min, d_max, h_min, h_max, w_min, w_max = bbox
            cropped_shape = (d_max - d_min, h_max - h_min, w_max - w_min)
        else:
            d_min, d_max = 0, H
            h_min, h_max = 0, W
            w_min, w_max = 0, D
            cropped_shape = original_shape

        # Calculate scale factors from cropped to target
        scale_d = cropped_shape[0] / target_size[0]
        scale_h = cropped_shape[1] / target_size[1]
        scale_w = cropped_shape[2] / target_size[2]

        # For each axis, calculate the mapping
        # Axial slices (Z axis = D dimension in our case, which is the 3rd dim)
        # After crop and resize, preprocessed slice i corresponds to:
        # original_slice = d_min + i * scale_d

        axial_mapping = []
        for i in range(target_size[2]):  # Z dimension = target_size[2] = 128
            # Preprocessed slice i maps to this original slice (float)
            original_z = w_min + (i + 0.5) * scale_w - 0.5
            axial_mapping.append({
                'preprocessed_idx': i,
                'original_idx_float': round(original_z, 2),
                'original_idx_nearest': int(round(original_z)),
            })

        # Sagittal mapping (X axis = H dimension)
        sagittal_mapping = []
        for i in range(target_size[0]):
            original_x = d_min + (i + 0.5) * scale_d - 0.5
            sagittal_mapping.append({
                'preprocessed_idx': i,
                'original_idx_float': round(original_x, 2),
                'original_idx_nearest': int(round(original_x)),
            })

        # Coronal mapping (Y axis = W dimension)
        coronal_mapping = []
        for i in range(target_size[1]):
            original_y = h_min + (i + 0.5) * scale_h - 0.5
            coronal_mapping.append({
                'preprocessed_idx': i,
                'original_idx_float': round(original_y, 2),
                'original_idx_nearest': int(round(original_y)),
            })

        return {
            'original_shape': original_shape,
            'cropped_shape': cropped_shape,
            'target_shape': target_size,
            'bbox': {
                'd_range': (d_min, d_max),
                'h_range': (h_min, h_max),
                'w_range': (w_min, w_max),
            },
            'scale_factors': {
                'd': round(scale_d, 4),
                'h': round(scale_h, 4),
                'w': round(scale_w, 4),
            },
            'axial_mapping': axial_mapping,
            'sagittal_mapping': sagittal_mapping,
            'coronal_mapping': coronal_mapping,
            'summary': {
                'axial': {
                    'original_range': (w_min, w_max - 1),
                    'preprocessed_range': (0, target_size[2] - 1),
                    'original_slice_per_preprocessed': round(scale_w, 3),
                },
                'sagittal': {
                    'original_range': (d_min, d_max - 1),
                    'preprocessed_range': (0, target_size[0] - 1),
                    'original_slice_per_preprocessed': round(scale_d, 3),
                },
                'coronal': {
                    'original_range': (h_min, h_max - 1),
                    'preprocessed_range': (0, target_size[1] - 1),
                    'original_slice_per_preprocessed': round(scale_h, 3),
                },
            }
        }


    def preprocess_ground_truth_from_dicom_bytes(
        self,
        seg_bytes: List[bytes],
        bbox: Optional[Tuple],
        original_shape: Tuple[int, int, int],
        verbose: bool = True,
    ) -> Optional[np.ndarray]:
        """
        Ground Truth segmentation을 DICOM 바이트에서 전처리

        MRI 전처리와 동일한 bbox, resize를 적용하여 정렬 보장

        Args:
            seg_bytes: Segmentation DICOM 바이트 데이터 리스트
            bbox: MRI 전처리에서 사용한 bounding box (d_min, d_max, h_min, h_max, w_min, w_max)
            original_shape: MRI의 원본 shape (H, W, D) after RAS orientation
            verbose: 타이밍 정보 출력 여부

        Returns:
            전처리된 Ground Truth mask (128, 128, 128) 또는 None
        """
        if not PYDICOM_AVAILABLE:
            raise ImportError("pydicom is required for DICOM processing")

        if not seg_bytes:
            print("[GT Preprocess] No segmentation bytes provided")
            return None

        timer = Timer(name="GT Preprocessing", verbose=verbose)
        timer.start()

        try:
            # Load segmentation from DICOM bytes
            seg_vol, seg_spacing = load_dicom_from_bytes(seg_bytes)
            timer.step(f"Load SEG ({len(seg_bytes)} slices)")

            print(f"[GT Preprocess] Loaded GT shape: {seg_vol.shape}, spacing: {seg_spacing}")

            # Resample to 1mm isotropic if needed
            if seg_spacing != self.target_spacing:
                from scipy.ndimage import zoom
                zoom_factors = [
                    seg_spacing[0] / self.target_spacing[0],
                    seg_spacing[1] / self.target_spacing[1],
                    seg_spacing[2] / self.target_spacing[2]
                ]
                # Use order=0 (nearest) for label data
                seg_vol = zoom(seg_vol, zoom_factors, order=0)
                timer.step(f"Resample to 1mm isotropic (from {seg_spacing})")
            else:
                timer.step("Spacing already 1mm (skip resample)")

            # Apply RAS orientation (same as MRI)
            seg_vol = np.flip(seg_vol, axis=(0, 1)).copy()
            timer.step("Apply RAS orientation (flip X, Y)")

            print(f"[GT Preprocess] After orientation: {seg_vol.shape}")

            # Convert to tensor and add channel dim
            seg_tensor = torch.from_numpy(seg_vol.astype(np.float32)).unsqueeze(0)

            # Apply same bbox crop as MRI
            if bbox is not None:
                d_min, d_max, h_min, h_max, w_min, w_max = bbox
                seg_tensor = seg_tensor[:, d_min:d_max, h_min:h_max, w_min:w_max]
                timer.step(f"Apply bbox crop: {bbox}")
            else:
                timer.step("No bbox (skip crop)")

            print(f"[GT Preprocess] After crop: {tuple(seg_tensor.shape)}")

            # Resize to target size using nearest neighbor (for labels)
            if MONAI_AVAILABLE:
                resize_transform = Resize(spatial_size=self.target_size, mode='nearest')
                seg_tensor = resize_transform(seg_tensor)
            else:
                seg_tensor = seg_tensor.unsqueeze(0)
                seg_tensor = torch.nn.functional.interpolate(
                    seg_tensor, size=self.target_size, mode='nearest'
                )
                seg_tensor = seg_tensor.squeeze(0)
            timer.step(f"Resize to {self.target_size}")

            # Convert segmentation labels to standard format (0,1,2,3)
            seg_result = seg_tensor.squeeze().numpy()

            # Check unique values before conversion
            unique_vals = np.unique(seg_result)
            print(f"[GT Preprocess] Raw unique values: {unique_vals}")

            # Handle different label formats:
            # 1. BraTS format: 0, 1, 2, 4 -> 0, 1, 2, 3
            # 2. uint16 format: 0, 32767, 65535 -> 0, 1, 2 (or 0, 2, 3)
            # 3. Binary format: 0, 255 or 0, 1 -> 0, 1

            if np.max(seg_result) > 255:
                # uint16 format (e.g., 0, 32767, 65535)
                # Map to standard labels based on sorted unique values
                label_map = {}
                sorted_vals = sorted(unique_vals)
                for i, val in enumerate(sorted_vals):
                    if i == 0:
                        label_map[val] = 0  # Background
                    elif i == 1:
                        label_map[val] = 2  # Edema (ED)
                    elif i == 2:
                        label_map[val] = 3  # Enhancing Tumor (ET)
                    else:
                        label_map[val] = min(i, 3)

                print(f"[GT Preprocess] uint16 label mapping: {label_map}")
                seg_mapped = np.zeros_like(seg_result, dtype=np.uint8)
                for old_val, new_val in label_map.items():
                    seg_mapped[seg_result == old_val] = new_val
                seg_result = seg_mapped
            else:
                # Standard BraTS or binary format
                seg_result = np.round(seg_result).astype(np.uint8)

                # Convert label 4 to 3 (BraTS format)
                seg_result[seg_result == 4] = 3

                # Handle binary format (0, 255) -> (0, 1)
                if 255 in unique_vals:
                    seg_result[seg_result == 255] = 1

            timer.step("Convert labels to standard format")

            # Print label distribution
            unique_labels, counts = np.unique(seg_result, return_counts=True)
            label_info = {int(l): int(c) for l, c in zip(unique_labels, counts)}
            print(f"[GT Preprocess] Label distribution: {label_info}")

            timer.summary()

            return seg_result

        except Exception as e:
            print(f"[GT Preprocess] Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return None


def preprocess_single(
    input_source: Union[str, dict],
    output_path: Optional[str] = None,
) -> dict:
    """
    편의 함수: 단일 환자 전처리

    Args:
        input_source: 폴더 경로 또는 {'t1': path, 't1ce': path, ...} dict
        output_path: 저장 경로 (None이면 저장 안함)

    Returns:
        전처리된 데이터 dict
    """
    preprocessor = M1Preprocessor()

    if isinstance(input_source, str):
        result = preprocessor.preprocess_from_folder(input_source)
    elif isinstance(input_source, dict):
        result = preprocessor.preprocess_from_files(
            t1_path=input_source['t1'],
            t1ce_path=input_source['t1ce'],
            t2_path=input_source['t2'],
            flair_path=input_source['flair'],
            seg_path=input_source.get('seg'),
            patient_id=input_source.get('patient_id'),
        )
    else:
        raise ValueError(f"Invalid input type: {type(input_source)}")

    if output_path:
        torch.save(result, output_path)
        print(f"Saved to: {output_path}")

    return result


# ============================================================
# CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description='M1 Preprocessing - Convert NIfTI to preprocessed tensor'
    )

    # Input options
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument('--input', '-i', type=str,
                             help='Input folder path (auto-detect modalities)')
    input_group.add_argument('--t1', type=str,
                             help='T1 NIfTI file path')

    parser.add_argument('--t1ce', type=str, help='T1ce NIfTI file path')
    parser.add_argument('--t2', type=str, help='T2 NIfTI file path')
    parser.add_argument('--flair', type=str, help='FLAIR NIfTI file path')
    parser.add_argument('--seg', type=str, help='Segmentation NIfTI file path (optional)')

    # Output
    parser.add_argument('--output', '-o', type=str, required=True,
                        help='Output .pt file path')

    # Options
    parser.add_argument('--dataset', type=str, default='auto',
                        choices=['auto', 'brats', 'ucsf'],
                        help='Dataset type for file naming convention')
    parser.add_argument('--patient-id', type=str, default=None,
                        help='Patient ID (default: folder name)')

    args = parser.parse_args()

    preprocessor = M1Preprocessor()

    if args.input:
        # Folder mode
        result = preprocessor.preprocess_from_folder(
            args.input,
            dataset_type=args.dataset
        )
    else:
        # Individual files mode
        if not all([args.t1, args.t1ce, args.t2, args.flair]):
            parser.error("When using --t1, must also provide --t1ce, --t2, --flair")

        result = preprocessor.preprocess_from_files(
            t1_path=args.t1,
            t1ce_path=args.t1ce,
            t2_path=args.t2,
            flair_path=args.flair,
            seg_path=args.seg,
            patient_id=args.patient_id,
        )

    # Save
    torch.save(result, args.output)

    # Print summary
    print("\n" + "="*50)
    print("M1 Preprocessing Complete")
    print("="*50)
    print(f"Output: {args.output}")
    print(f"Image shape: {result['image'].shape}")
    if result['label'] is not None:
        print(f"Label shape: {result['label'].shape}")
    print(f"Patient ID: {result['patient_id']}")
    print(f"Dataset: {result['dataset']}")
    print(f"Normalization: {result['normalization']}")

    # Channel stats
    print("\nChannel statistics:")
    modality_names = ['T1', 'T1ce', 'T2', 'FLAIR']
    for i, name in enumerate(modality_names):
        ch = result['image'][i]
        print(f"  {name}: min={ch.min():.4f}, max={ch.max():.4f}, mean={ch.mean():.4f}")


if __name__ == "__main__":
    main()
