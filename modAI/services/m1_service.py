"""
M1 Model Service

MRI 기반 Classification 추론 서비스
- Reference: fastapi_model/services/m1_service.py
"""

import sys
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional, List
import time
import logging

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import settings
from inference.m1_preprocess import M1Preprocessor

logger = logging.getLogger(__name__)


class M1InferenceService:
    """M1 Model 추론 서비스 (Reference 구조 기반)"""

    GRADE_CLASSES = ['G2', 'G3', 'G4']
    IDH_CLASSES = ['Wildtype', 'Mutant']
    MGMT_CLASSES = ['Unmethylated', 'Methylated']

    # Model validation C-Index (from checkpoint metrics)
    MODEL_CINDEX = 0.6596

    def __init__(self):
        self.preprocessor = M1Preprocessor()
        self.model = None
        self.cls_heads = None
        self.encoder_dim = 768  # SwinUNETR default (48 * 16)
        self._device = None

    @property
    def device(self):
        if self._device is None:
            if settings.DEVICE == "auto":
                self._device = "cuda" if torch.cuda.is_available() else "cpu"
            else:
                self._device = settings.DEVICE
        return self._device

    def load_model(self) -> None:
        """모델 로드 - SwinUNETR backbone + Classification heads"""
        if self.model is not None:
            print("[M1Service] Model already loaded, skipping...")
            return

        print("=" * 60)
        print("[M1Service] Loading M1 model...")
        print(f"  Backbone weights: {settings.M1_SEG_WEIGHTS_PATH}")
        print(f"  Classification weights: {settings.M1_WEIGHTS_PATH}")
        print(f"  Device: {self.device}")
        print(f"  Backbone exists: {Path(settings.M1_SEG_WEIGHTS_PATH).exists()}")
        print(f"  Classification exists: {Path(settings.M1_WEIGHTS_PATH).exists()}")

        try:
            print("[M1Service] Importing MONAI SwinUNETR...")
            from monai.networks.nets import SwinUNETR

            # Create SwinUNETR model
            print("[M1Service] Creating SwinUNETR model...")
            self.model = SwinUNETR(
                in_channels=4,
                out_channels=4,
                feature_size=48,
                use_checkpoint=False,
                spatial_dims=3,
            )
            self.encoder_dim = 768  # 48 * 16
            print(f"[M1Service] SwinUNETR created, encoder_dim={self.encoder_dim}")

            # Load backbone weights from M1_Seg_separate_best.pth
            seg_weights_path = settings.M1_SEG_WEIGHTS_PATH
            if Path(seg_weights_path).exists():
                print(f"[M1Service] Loading backbone weights from {seg_weights_path}...")
                checkpoint = torch.load(
                    seg_weights_path, map_location=self.device, weights_only=False
                )
                print(f"[M1Service] Checkpoint keys: {list(checkpoint.keys()) if isinstance(checkpoint, dict) else 'raw_state_dict'}")

                if 'model_state_dict' in checkpoint:
                    state_dict = checkpoint['model_state_dict']
                else:
                    state_dict = checkpoint

                print(f"[M1Service] State dict has {len(state_dict)} keys")

                # Filter out incompatible keys
                model_dict = self.model.state_dict()
                filtered_dict = {}
                skipped_keys = []
                for k, v in state_dict.items():
                    if k in model_dict:
                        if model_dict[k].shape == v.shape:
                            filtered_dict[k] = v
                        else:
                            skipped_keys.append(f"{k}: {v.shape} vs {model_dict[k].shape}")
                    else:
                        skipped_keys.append(f"{k}: not in model")

                self.model.load_state_dict(filtered_dict, strict=False)
                print(f"[M1Service] Loaded {len(filtered_dict)}/{len(model_dict)} backbone layers")
                if skipped_keys and len(skipped_keys) < 10:
                    print(f"[M1Service] Skipped keys: {skipped_keys}")
            else:
                print(f"[M1Service] WARNING: Backbone weights not found: {seg_weights_path}")

            print("[M1Service] MONAI SwinUNETR backbone loaded successfully")

        except Exception as e:
            import traceback
            print(f"[M1Service] ERROR: MONAI SwinUNETR failed: {e}")
            print(traceback.format_exc())
            print("[M1Service] Using simplified model for demo")
            self.model = self._create_simple_model()
            self.encoder_dim = self.model.feature_dim

        # Add classification heads
        print("[M1Service] Adding classification heads...")
        self._add_classification_heads()

        self.model.to(self.device)
        self.model.eval()
        print(f"[M1Service] M1 model ready on {self.device}!")
        print("=" * 60)

    def _create_simple_model(self) -> nn.Module:
        """Create a simple model for demo (fallback)"""

        class SimpleM1Model(nn.Module):
            def __init__(self):
                super().__init__()
                self.encoder = nn.Sequential(
                    nn.Conv3d(4, 32, 3, stride=2, padding=1),
                    nn.BatchNorm3d(32),
                    nn.ReLU(),
                    nn.Conv3d(32, 64, 3, stride=2, padding=1),
                    nn.BatchNorm3d(64),
                    nn.ReLU(),
                    nn.Conv3d(64, 128, 3, stride=2, padding=1),
                    nn.BatchNorm3d(128),
                    nn.ReLU(),
                    nn.Conv3d(128, 256, 3, stride=2, padding=1),
                    nn.BatchNorm3d(256),
                    nn.ReLU(),
                    nn.AdaptiveAvgPool3d(1)
                )
                self.feature_dim = 256

            def forward(self, x):
                return self.encoder(x).view(x.size(0), -1)

        return SimpleM1Model()

    def _add_classification_heads(self):
        """Add classification heads and load trained weights"""

        class ClassificationHeads(nn.Module):
            def __init__(self, encoder_dim):
                super().__init__()
                # Grade: 3 classes (matches trained structure)
                self.grade_head = nn.Sequential(
                    nn.Linear(encoder_dim, 256),
                    nn.ReLU(),
                    nn.Dropout(0.3),
                    nn.Linear(256, 3)
                )
                # IDH: binary
                self.idh_head = nn.Sequential(
                    nn.Linear(encoder_dim, 128),
                    nn.ReLU(),
                    nn.Dropout(0.2),
                    nn.Linear(128, 1)
                )
                # MGMT: binary
                self.mgmt_head = nn.Sequential(
                    nn.Linear(encoder_dim, 128),
                    nn.ReLU(),
                    nn.Dropout(0.2),
                    nn.Linear(128, 1)
                )
                # Survival (matches trained structure: 768->128->64->1)
                self.survival_head = nn.Sequential(
                    nn.Linear(encoder_dim, 128),
                    nn.ReLU(),
                    nn.Dropout(0.3),
                    nn.Linear(128, 64),
                    nn.ReLU(),
                    nn.Dropout(0.3),
                    nn.Linear(64, 1)
                )

        self.cls_heads = ClassificationHeads(self.encoder_dim).to(self.device)

        # Load trained classification heads weights
        self._load_classification_weights()

    def _load_classification_weights(self):
        """Load trained classification head weights from m1_best.pth"""
        cls_weights_path = settings.M1_WEIGHTS_PATH
        if not Path(cls_weights_path).exists():
            print(f"[M1Service] WARNING: Classification weights not found: {cls_weights_path}")
            return

        try:
            print(f"[M1Service] Loading classification weights from {cls_weights_path}...")
            checkpoint = torch.load(cls_weights_path, map_location=self.device, weights_only=False)
            print(f"[M1Service] Classification checkpoint keys: {list(checkpoint.keys()) if isinstance(checkpoint, dict) else 'raw_state_dict'}")

            state_dict = checkpoint.get('model_state_dict', checkpoint)

            # Extract classification head weights
            cls_state_dict = {}
            for k, v in state_dict.items():
                if any(head in k for head in ['grade_head', 'idh_head', 'mgmt_head', 'survival_head']):
                    cls_state_dict[k] = v

            print(f"[M1Service] Found {len(cls_state_dict)} classification head layers:")
            for k in cls_state_dict.keys():
                print(f"  - {k}: {cls_state_dict[k].shape}")

            # Load into cls_heads
            self.cls_heads.load_state_dict(cls_state_dict, strict=False)
            print(f"[M1Service] Classification heads loaded successfully")

            # Print metrics if available
            if 'metrics' in checkpoint:
                metrics = checkpoint['metrics']
                print(f"[M1Service] Model metrics:")
                print(f"  - Grade Acc: {metrics.get('grade_acc', 0):.1%}")
                print(f"  - IDH AUC: {metrics.get('idh_auc', 0):.3f}")
                print(f"  - MGMT AUC: {metrics.get('mgmt_auc', 0):.3f}")

            if 'best_score' in checkpoint:
                print(f"[M1Service] Best score: {checkpoint['best_score']:.4f}")

        except Exception as e:
            import traceback
            print(f"[M1Service] ERROR: Failed to load classification weights: {e}")
            print(traceback.format_exc())

    def _get_features(self, input_tensor: torch.Tensor) -> torch.Tensor:
        """Extract features from model using swinViT"""
        print(f"[M1Service] Extracting features from input shape: {input_tensor.shape}")

        with torch.no_grad():
            if hasattr(self.model, 'swinViT'):
                # MONAI SwinUNETR - get hidden states from swinViT
                print("[M1Service] Using swinViT for feature extraction...")
                hidden_states = self.model.swinViT(input_tensor, self.model.normalize)
                print(f"[M1Service] Got {len(hidden_states)} hidden states")
                for i, hs in enumerate(hidden_states):
                    print(f"  - hidden_state[{i}]: {hs.shape}")

                features = hidden_states[-1]  # Last hidden state
                print(f"[M1Service] Using last hidden state: {features.shape}")

                pooled = F.adaptive_avg_pool3d(features, 1).view(input_tensor.size(0), -1)
                print(f"[M1Service] After pooling: {pooled.shape}")

            elif hasattr(self.model, 'encoder'):
                # Simple model
                print("[M1Service] Using simple encoder...")
                pooled = self.model(input_tensor)
            else:
                print("[M1Service] WARNING: No valid encoder found, using random features!")
                pooled = torch.randn(input_tensor.size(0), self.encoder_dim).to(self.device)

            # Adjust dimension if needed
            if pooled.shape[-1] != self.encoder_dim:
                print(f"[M1Service] Adjusting feature dim from {pooled.shape[-1]} to {self.encoder_dim}")
                pooled = F.adaptive_avg_pool1d(pooled.unsqueeze(1), self.encoder_dim).squeeze(1)

        print(f"[M1Service] Final features shape: {pooled.shape}")
        return pooled

    def preprocess(
        self,
        dicom_data: Dict[str, List[bytes]],
        patient_id: str
    ) -> dict:
        """
        DICOM 데이터 전처리

        Args:
            dicom_data: {'T1': [bytes], 'T1CE': [bytes], 'T2': [bytes], 'FLAIR': [bytes]}
            patient_id: 환자 ID

        Returns:
            전처리된 데이터 dict with 'image' tensor (4, 128, 128, 128)
        """
        logger.info(f"Preprocessing DICOM data for patient: {patient_id}")

        return self.preprocessor.preprocess_from_dicom_bytes(
            t1_bytes=dicom_data['T1'],
            t1ce_bytes=dicom_data['T1CE'],
            t2_bytes=dicom_data['T2'],
            flair_bytes=dicom_data['FLAIR'],
            patient_id=patient_id,
            verbose=True,
        )

    def predict(self, preprocessed: dict) -> Dict[str, Any]:
        """
        M1 모델 추론

        Args:
            preprocessed: 전처리된 데이터 dict with 'image' tensor

        Returns:
            추론 결과 dict
        """
        print("[M1Service] Starting prediction...")
        self.load_model()
        start_time = time.time()

        # 이미지 텐서 추출 및 device 이동
        image_tensor = preprocessed['image']
        print(f"[M1Service] Input tensor shape: {image_tensor.shape}, dtype: {image_tensor.dtype}")

        if image_tensor.ndim == 4:
            image_tensor = image_tensor.unsqueeze(0)
            print(f"[M1Service] Added batch dim: {image_tensor.shape}")

        image_tensor = image_tensor.to(self.device)
        print(f"[M1Service] Tensor moved to {self.device}")

        # Extract features from encoder
        print("[M1Service] Extracting encoder features...")
        pooled = self._get_features(image_tensor)

        results = {}

        print("[M1Service] Running classification heads...")
        with torch.no_grad():
            # Grade
            print("[M1Service] Grade prediction...")
            grade_logits = self.cls_heads.grade_head(pooled)
            print(f"  - grade_logits: {grade_logits}")
            grade_probs = F.softmax(grade_logits, dim=-1).squeeze().cpu().numpy()
            print(f"  - grade_probs: {grade_probs}")
            grade_idx = int(np.argmax(grade_probs))
            results["grade"] = {
                "predicted_class": self.GRADE_CLASSES[grade_idx],
                "probability": float(grade_probs[grade_idx]),
                "probabilities": {
                    cls: float(p) for cls, p in zip(self.GRADE_CLASSES, grade_probs)
                }
            }
            print(f"  - Grade result: {results['grade']['predicted_class']} ({results['grade']['probability']:.2%})")

            # IDH
            print("[M1Service] IDH prediction...")
            idh_logit = self.cls_heads.idh_head(pooled)
            print(f"  - idh_logit: {idh_logit}")
            idh_prob = torch.sigmoid(idh_logit).item()
            print(f"  - idh_prob (mutant): {idh_prob:.4f}")
            results["idh"] = {
                "predicted_class": "Mutant" if idh_prob > 0.5 else "Wildtype",
                "probability": float(idh_prob if idh_prob > 0.5 else 1 - idh_prob),
                "mutant_probability": float(idh_prob),
                "wildtype_probability": float(1 - idh_prob),
            }
            print(f"  - IDH result: {results['idh']['predicted_class']}")

            # MGMT
            print("[M1Service] MGMT prediction...")
            mgmt_logit = self.cls_heads.mgmt_head(pooled)
            print(f"  - mgmt_logit: {mgmt_logit}")
            mgmt_prob = torch.sigmoid(mgmt_logit).item()
            print(f"  - mgmt_prob (methylated): {mgmt_prob:.4f}")
            results["mgmt"] = {
                "predicted_class": "Methylated" if mgmt_prob > 0.5 else "Unmethylated",
                "probability": float(mgmt_prob if mgmt_prob > 0.5 else 1 - mgmt_prob),
                "methylated_probability": float(mgmt_prob),
                "unmethylated_probability": float(1 - mgmt_prob),
            }
            print(f"  - MGMT result: {results['mgmt']['predicted_class']}")

            # Survival
            print("[M1Service] Survival prediction...")
            surv_out = self.cls_heads.survival_head(pooled)
            print(f"  - surv_out: {surv_out}")
            risk_score = torch.sigmoid(surv_out).item()
            print(f"  - risk_score: {risk_score:.4f}")
            risk_group = "High" if risk_score > 0.7 else ("Medium" if risk_score > 0.3 else "Low")

            # Confidence calculation
            if risk_score > 0.7:
                confidence = (risk_score - 0.7) / 0.3
            elif risk_score < 0.3:
                confidence = (0.3 - risk_score) / 0.3
            else:
                confidence = 0.5 - abs(risk_score - 0.5)

            # Interpretation
            if risk_group == "High":
                interpretation = f"고위험군 (위험점수: {risk_score:.2f}). 적극적인 치료와 면밀한 추적 관찰이 필요합니다."
            elif risk_group == "Medium":
                interpretation = f"중위험군 (위험점수: {risk_score:.2f}). 정기적인 추적 관찰을 권장합니다."
            else:
                interpretation = f"저위험군 (위험점수: {risk_score:.2f}). 표준 치료 프로토콜을 유지하세요."

            results["survival"] = {
                "risk_score": float(risk_score),
                "risk_category": risk_group,
                "risk_group": risk_group,
                "confidence": float(max(0, min(1, confidence))),
                "interpretation": interpretation,
                "model_cindex": self.MODEL_CINDEX,
            }
            print(f"  - Survival result: {risk_group} (risk_score={risk_score:.4f})")

        # Encoder features for MM model (768-dim)
        print("[M1Service] Extracting encoder features for MM model...")
        encoder_features = pooled.squeeze().cpu().numpy()
        print(f"  - Encoder features shape: {encoder_features.shape}")
        print(f"  - Encoder features stats: min={encoder_features.min():.4f}, max={encoder_features.max():.4f}, mean={encoder_features.mean():.4f}")
        results["encoder_features"] = encoder_features.tolist()

        processing_time = (time.time() - start_time) * 1000
        results["processing_time_ms"] = processing_time

        print(f"[M1Service] Prediction complete in {processing_time:.1f}ms")
        print(f"[M1Service] Results: Grade={results['grade']['predicted_class']}, IDH={results['idh']['predicted_class']}, MGMT={results['mgmt']['predicted_class']}")

        return results

    def _run_segmentation(self, input_tensor: torch.Tensor) -> Dict[str, Any]:
        """
        Run segmentation and return mask + volumes + MRI for visualization

        Args:
            input_tensor: 전처리된 MRI 입력 (1, 4, 128, 128, 128)

        Returns:
            세그멘테이션 결과 dict (volumes, mask, visualization)
        """
        print("[M1Service] Running segmentation...")

        with torch.no_grad():
            # Run full model forward pass for segmentation
            if hasattr(self.model, 'swinViT'):
                # MONAI SwinUNETR - full forward pass
                print("[M1Service] Running SwinUNETR forward pass for segmentation...")
                seg_output = self.model(input_tensor)  # (1, 4, D, H, W)
                print(f"[M1Service] Segmentation output shape: {seg_output.shape}")

                seg_mask = torch.argmax(seg_output, dim=1).squeeze().cpu().numpy()  # (D, H, W)
                print(f"[M1Service] Segmentation mask shape: {seg_mask.shape}")
            else:
                # Simple model - create dummy segmentation
                print("[M1Service] Using simple model - creating dummy segmentation")
                seg_mask = np.zeros((128, 128, 128), dtype=np.uint8)

            # Calculate tumor volumes (assuming 1mm isotropic voxels)
            voxel_volume_ml = 0.001  # 1mm^3 = 0.001 cm^3

            # BraTS labels: 0=background, 1=NCR(Necrotic Core), 2=ED(Edema), 3=ET(Enhancing Tumor)
            ncr_volume = float((seg_mask == 1).sum() * voxel_volume_ml)
            ed_volume = float((seg_mask == 2).sum() * voxel_volume_ml)
            et_volume = float((seg_mask == 3).sum() * voxel_volume_ml)

            # Whole Tumor (WT) = NCR + ED + ET
            wt_volume = ncr_volume + ed_volume + et_volume
            # Tumor Core (TC) = NCR + ET
            tc_volume = ncr_volume + et_volume

            print(f"[M1Service] Tumor volumes:")
            print(f"  - Whole Tumor (WT): {wt_volume:.2f} ml")
            print(f"  - Tumor Core (TC): {tc_volume:.2f} ml")
            print(f"  - Enhancing Tumor (ET): {et_volume:.2f} ml")
            print(f"  - Necrotic Core (NCR): {ncr_volume:.2f} ml")
            print(f"  - Edema (ED): {ed_volume:.2f} ml")

            # Get MRI data for visualization (T1CE channel, normalized 0-1)
            mri_data = input_tensor[0, 1].cpu().numpy()  # T1CE channel (index 1)
            mri_min, mri_max = mri_data.min(), mri_data.max()
            if mri_max > mri_min:
                mri_normalized = (mri_data - mri_min) / (mri_max - mri_min)
            else:
                mri_normalized = mri_data

            # Full resolution for JSON response (128^3) - can be downsampled if needed
            step = 1
            mri_down = mri_normalized[::step, ::step, ::step]
            seg_down = seg_mask[::step, ::step, ::step].astype(np.uint8)

            # Count unique labels
            unique_labels, label_counts = np.unique(seg_mask, return_counts=True)
            label_info = {int(label): int(count) for label, count in zip(unique_labels, label_counts)}
            print(f"[M1Service] Label distribution: {label_info}")

            return {
                "wt_volume": round(wt_volume, 2),
                "tc_volume": round(tc_volume, 2),
                "et_volume": round(et_volume, 2),
                "ncr_volume": round(ncr_volume, 2),
                "ed_volume": round(ed_volume, 2),
                "mask_shape": list(seg_mask.shape),
                "label_distribution": label_info,
                "visualization": {
                    "mri": mri_down.round(3).tolist(),  # 128x128x128 MRI
                    "prediction": seg_down.tolist(),  # 128x128x128 segmentation
                    "shape": list(seg_down.shape),
                }
            }

    def predict_with_segmentation(self, preprocessed: dict) -> Dict[str, Any]:
        """
        M1 모델 추론 (분류 + 세그멘테이션)

        Args:
            preprocessed: 전처리된 데이터 dict with 'image' tensor

        Returns:
            추론 결과 dict (분류 결과 + 세그멘테이션 결과 + 전처리된 MRI)
        """
        print("[M1Service] Starting prediction with segmentation...")

        # 먼저 분류 결과 얻기
        results = self.predict(preprocessed)

        # 세그멘테이션 실행
        image_tensor = preprocessed['image']
        if image_tensor.ndim == 4:
            image_tensor = image_tensor.unsqueeze(0)
        image_tensor = image_tensor.to(self.device)

        seg_result = self._run_segmentation(image_tensor)
        results["segmentation"] = seg_result

        # 전처리된 MRI 4채널 저장 (T1, T1CE, T2, FLAIR) - SegMRIViewer용
        # image_tensor shape: (1, 4, 128, 128, 128)
        mri_numpy = image_tensor[0].cpu().numpy()  # (4, 128, 128, 128)

        # 각 채널 정규화 (0-1)
        preprocessed_mri = {}
        channel_names = ['t1', 't1ce', 't2', 'flair']
        for i, name in enumerate(channel_names):
            ch_data = mri_numpy[i]
            ch_min, ch_max = ch_data.min(), ch_data.max()
            if ch_max > ch_min:
                ch_normalized = (ch_data - ch_min) / (ch_max - ch_min)
            else:
                ch_normalized = ch_data
            preprocessed_mri[name] = ch_normalized.astype(np.float32)

        preprocessed_mri['shape'] = list(mri_numpy.shape[1:])  # [128, 128, 128]
        results["preprocessed_mri"] = preprocessed_mri
        print(f"[M1Service] Preprocessed MRI saved: shape={mri_numpy.shape}")

        print("[M1Service] Prediction with segmentation complete!")
        return results

    def get_encoder_features(self, preprocessed: dict) -> np.ndarray:
        """
        MM 모델용 768-dim encoder features 추출

        Args:
            preprocessed: 전처리된 데이터 dict

        Returns:
            768-dim numpy array
        """
        self.load_model()

        image_tensor = preprocessed['image']
        if image_tensor.ndim == 4:
            image_tensor = image_tensor.unsqueeze(0)
        image_tensor = image_tensor.to(self.device)

        pooled = self._get_features(image_tensor)

        # Ensure 768-dim output
        if pooled.shape[-1] != 768:
            pooled = F.adaptive_avg_pool1d(pooled.unsqueeze(1), 768).squeeze(1)

        return pooled[0].cpu().numpy()

    def save_results(
        self,
        result: Dict[str, Any],
        job_id: str,
        storage_dir: Path = None,
    ) -> Dict[str, str]:
        """
        추론 결과를 파일로 저장

        저장 구조:
        - CDSS_STORAGE/AI/<job_id>/
          - m1_classification.json  : 분류 결과 (grade, idh, mgmt, survival)
          - m1_encoder_features.npz : 768-dim encoder features (MM 모델용)
          - m1_segmentation.npz     : 세그멘테이션 마스크 + 볼륨 정보
          - m1_preprocessed_mri.npz : 전처리된 MRI 4채널 (T1, T1CE, T2, FLAIR)

        Args:
            result: predict_with_segmentation 결과 dict
            job_id: 작업 ID
            storage_dir: 저장 경로 (기본값: settings.STORAGE_DIR)

        Returns:
            파일명만 포함된 dict (절대경로 = CDSS_STORAGE/AI/<job_id>/<filename>)
        """
        import json

        if storage_dir is None:
            storage_dir = settings.STORAGE_DIR

        output_dir = Path(storage_dir) / job_id
        output_dir.mkdir(parents=True, exist_ok=True)

        # 파일명만 저장 (절대경로는 CDSS_STORAGE/AI/<job_id>/ 기준)
        saved_files = {
            "job_id": job_id,
        }

        print(f"[M1Service] Saving results to: {output_dir}")

        # ============================================================
        # 1. Classification 결과 저장 (JSON)
        # ============================================================
        classification_data = {
            "job_id": job_id,
            "model": "M1",
            "grade": result.get("grade"),
            "idh": result.get("idh"),
            "mgmt": result.get("mgmt"),
            "survival": result.get("survival"),
            "processing_time_ms": result.get("processing_time_ms"),
        }

        cls_filename = "m1_classification.json"
        classification_file = output_dir / cls_filename
        with open(classification_file, "w", encoding="utf-8") as f:
            json.dump(classification_data, f, ensure_ascii=False, indent=2)

        saved_files["m1_classification"] = cls_filename
        print(f"  - Classification saved: {cls_filename}")

        # ============================================================
        # 2. Encoder Features 저장 (NPZ)
        # ============================================================
        if "encoder_features" in result:
            encoder_features = np.array(result["encoder_features"])
            feat_filename = "m1_encoder_features.npz"
            features_file = output_dir / feat_filename
            np.savez_compressed(
                features_file,
                features=encoder_features,
                shape=encoder_features.shape,
                dtype=str(encoder_features.dtype)
            )
            saved_files["m1_encoder_features"] = feat_filename
            print(f"  - Encoder features saved: {feat_filename} (shape={encoder_features.shape})")

        # ============================================================
        # 3. Segmentation 결과 저장 (NPZ)
        # ============================================================
        if "segmentation" in result:
            seg = result["segmentation"]

            # 볼륨 정보
            volumes = {
                "wt_volume": seg.get("wt_volume", 0),
                "tc_volume": seg.get("tc_volume", 0),
                "et_volume": seg.get("et_volume", 0),
                "ncr_volume": seg.get("ncr_volume", 0),
                "ed_volume": seg.get("ed_volume", 0),
            }

            # 세그멘테이션 마스크
            seg_mask = None
            if "visualization" in seg and "prediction" in seg["visualization"]:
                seg_mask = np.array(seg["visualization"]["prediction"], dtype=np.uint8)

            seg_filename = "m1_segmentation.npz"
            segmentation_file = output_dir / seg_filename
            save_data = {
                "wt_volume": volumes["wt_volume"],
                "tc_volume": volumes["tc_volume"],
                "et_volume": volumes["et_volume"],
                "ncr_volume": volumes["ncr_volume"],
                "ed_volume": volumes["ed_volume"],
                "mask_shape": np.array(seg.get("mask_shape", [128, 128, 128])),
                "label_distribution": np.array(list(seg.get("label_distribution", {}).items())),
            }

            if seg_mask is not None:
                save_data["mask"] = seg_mask

            # MRI 데이터도 함께 저장 (SegMRIViewer용)
            if "visualization" in seg and "mri" in seg["visualization"]:
                mri_data = np.array(seg["visualization"]["mri"], dtype=np.float32)
                save_data["mri"] = mri_data
                print(f"    MRI data saved: shape={mri_data.shape}")

            np.savez_compressed(segmentation_file, **save_data)
            saved_files["m1_segmentation"] = seg_filename
            print(f"  - Segmentation saved: {seg_filename}")
            print(f"    Volumes: WT={volumes['wt_volume']:.2f}ml, TC={volumes['tc_volume']:.2f}ml, ET={volumes['et_volume']:.2f}ml")

        # ============================================================
        # 4. Preprocessed MRI 저장 (NPZ) - SegMRIViewer용
        # ============================================================
        if "preprocessed_mri" in result:
            mri = result["preprocessed_mri"]
            mri_filename = "m1_preprocessed_mri.npz"
            mri_file = output_dir / mri_filename

            mri_save_data = {
                "t1": mri.get("t1"),
                "t1ce": mri.get("t1ce"),
                "t2": mri.get("t2"),
                "flair": mri.get("flair"),
                "shape": np.array(mri.get("shape", [128, 128, 128])),
            }

            np.savez_compressed(mri_file, **mri_save_data)
            saved_files["m1_preprocessed_mri"] = mri_filename
            print(f"  - Preprocessed MRI saved: {mri_filename}")
            print(f"    Channels: T1, T1CE, T2, FLAIR (shape={mri.get('shape')})")

        print(f"[M1Service] All results saved successfully!")
        print(f"[M1Service] Files: {saved_files}")

        return saved_files

    def prepare_results_for_callback(
        self,
        result: Dict[str, Any],
        job_id: str,
    ) -> Dict[str, Dict[str, str]]:
        """
        추론 결과를 callback용 파일 내용으로 변환 (CDSS_STORAGE 직접 저장 없음)

        Returns:
            {filename: {content: base64/json, type: 'json'|'npz'}}
        """
        import json
        import base64
        from io import BytesIO

        files_data = {}

        print(f"[M1Service] Preparing results for callback: job_id={job_id}")

        # ============================================================
        # 1. Classification 결과 (JSON)
        # ============================================================
        classification_data = {
            "job_id": job_id,
            "model": "M1",
            "grade": result.get("grade"),
            "idh": result.get("idh"),
            "mgmt": result.get("mgmt"),
            "survival": result.get("survival"),
            "processing_time_ms": result.get("processing_time_ms"),
        }

        files_data["m1_classification.json"] = {
            "content": json.dumps(classification_data, ensure_ascii=False, indent=2),
            "type": "json"
        }
        print(f"  - Classification prepared")

        # ============================================================
        # 2. Encoder Features (NPZ -> base64)
        # ============================================================
        if "encoder_features" in result:
            encoder_features = np.array(result["encoder_features"])
            buffer = BytesIO()
            np.savez_compressed(
                buffer,
                features=encoder_features,
                shape=encoder_features.shape,
                dtype=str(encoder_features.dtype)
            )
            buffer.seek(0)
            files_data["m1_encoder_features.npz"] = {
                "content": base64.b64encode(buffer.read()).decode('ascii'),
                "type": "npz"
            }
            print(f"  - Encoder features prepared (shape={encoder_features.shape})")

        # ============================================================
        # 3. Segmentation 결과 (NPZ -> base64)
        # ============================================================
        if "segmentation" in result:
            seg = result["segmentation"]

            volumes = {
                "wt_volume": seg.get("wt_volume", 0),
                "tc_volume": seg.get("tc_volume", 0),
                "et_volume": seg.get("et_volume", 0),
                "ncr_volume": seg.get("ncr_volume", 0),
                "ed_volume": seg.get("ed_volume", 0),
            }

            seg_mask = None
            if "visualization" in seg and "prediction" in seg["visualization"]:
                seg_mask = np.array(seg["visualization"]["prediction"], dtype=np.uint8)

            save_data = {
                "wt_volume": volumes["wt_volume"],
                "tc_volume": volumes["tc_volume"],
                "et_volume": volumes["et_volume"],
                "ncr_volume": volumes["ncr_volume"],
                "ed_volume": volumes["ed_volume"],
                "mask_shape": np.array(seg.get("mask_shape", [128, 128, 128])),
                "label_distribution": np.array(list(seg.get("label_distribution", {}).items())),
            }

            if seg_mask is not None:
                save_data["mask"] = seg_mask

            if "visualization" in seg and "mri" in seg["visualization"]:
                mri_data = np.array(seg["visualization"]["mri"], dtype=np.float32)
                save_data["mri"] = mri_data

            buffer = BytesIO()
            np.savez_compressed(buffer, **save_data)
            buffer.seek(0)
            files_data["m1_segmentation.npz"] = {
                "content": base64.b64encode(buffer.read()).decode('ascii'),
                "type": "npz"
            }
            print(f"  - Segmentation prepared")

        # ============================================================
        # 4. Preprocessed MRI (NPZ -> base64)
        # ============================================================
        if "preprocessed_mri" in result:
            mri = result["preprocessed_mri"]
            mri_save_data = {
                "t1": mri.get("t1"),
                "t1ce": mri.get("t1ce"),
                "t2": mri.get("t2"),
                "flair": mri.get("flair"),
                "shape": np.array(mri.get("shape", [128, 128, 128])),
            }

            buffer = BytesIO()
            np.savez_compressed(buffer, **mri_save_data)
            buffer.seek(0)
            files_data["m1_preprocessed_mri.npz"] = {
                "content": base64.b64encode(buffer.read()).decode('ascii'),
                "type": "npz"
            }
            print(f"  - Preprocessed MRI prepared")

        print(f"[M1Service] Total {len(files_data)} files prepared for callback")

        return files_data

    @staticmethod
    def get_result_file_path(storage_dir: Path, job_id: str, filename: str) -> Path:
        """
        저장된 결과 파일의 절대경로 반환

        Args:
            storage_dir: CDSS_STORAGE/AI 경로
            job_id: 작업 ID
            filename: 파일명 (m1_classification.json 등)

        Returns:
            절대 경로 Path 객체
        """
        return Path(storage_dir) / job_id / filename

    @staticmethod
    def load_classification(storage_dir: Path, job_id: str) -> Dict[str, Any]:
        """분류 결과 로드"""
        import json
        filepath = Path(storage_dir) / job_id / "m1_classification.json"
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def load_encoder_features(storage_dir: Path, job_id: str) -> np.ndarray:
        """인코더 피처 로드"""
        filepath = Path(storage_dir) / job_id / "m1_encoder_features.npz"
        data = np.load(filepath)
        return data["features"]

    @staticmethod
    def load_segmentation(storage_dir: Path, job_id: str) -> Dict[str, Any]:
        """세그멘테이션 결과 로드"""
        filepath = Path(storage_dir) / job_id / "m1_segmentation.npz"
        data = np.load(filepath)
        return {
            "wt_volume": float(data["wt_volume"]),
            "tc_volume": float(data["tc_volume"]),
            "et_volume": float(data["et_volume"]),
            "ncr_volume": float(data["ncr_volume"]),
            "ed_volume": float(data["ed_volume"]),
            "mask_shape": data["mask_shape"].tolist(),
            "mask": data["mask"] if "mask" in data else None,
        }
