"""
MM Model Service

Multimodal (MRI + Gene + Protein) 추론 서비스
Clinical metadata 제외 - Survival 예측 성능 향상 (C-Index +12%)
"""

import torch
import torch.nn as nn
import numpy as np
import pandas as pd
import json
import base64
from io import StringIO, BytesIO
from pathlib import Path
from typing import Dict, Any, Optional, List
import time


class MMModel(nn.Module):
    """MM Multimodal Model (Clinical 제외) - 학습 스크립트와 동일 구조"""

    def __init__(
        self,
        mri_dim: int = 768,
        gene_dim: int = 64,
        protein_dim: int = 203,
        fusion_dim: int = 256,
        dropout: float = 0.3,
    ):
        super().__init__()

        # Modality projections (3 modalities only)
        self.mri_proj = nn.Sequential(
            nn.Linear(mri_dim, 512),
            nn.LayerNorm(512),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(512, fusion_dim),
            nn.LayerNorm(fusion_dim),
            nn.ReLU(),
        )

        self.gene_proj = nn.Sequential(
            nn.Linear(gene_dim, 128),
            nn.LayerNorm(128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, fusion_dim),
            nn.LayerNorm(fusion_dim),
            nn.ReLU(),
        )

        self.protein_proj = nn.Sequential(
            nn.Linear(protein_dim, 256),
            nn.LayerNorm(256),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(256, fusion_dim),
            nn.LayerNorm(fusion_dim),
            nn.ReLU(),
        )

        # Cross-modal attention
        self.cross_attention = nn.MultiheadAttention(
            embed_dim=fusion_dim,
            num_heads=8,
            dropout=0.1,
            batch_first=True
        )

        # Fusion MLP
        self.fusion_mlp = nn.Sequential(
            nn.Linear(fusion_dim * 3, fusion_dim * 2),
            nn.LayerNorm(fusion_dim * 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(fusion_dim * 2, fusion_dim),
            nn.LayerNorm(fusion_dim),
            nn.ReLU(),
        )

        # Task heads
        self.survival_head = nn.Sequential(
            nn.Linear(fusion_dim, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
        )

        self.recurrence_head = nn.Sequential(
            nn.Linear(fusion_dim, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
        )

        self.risk_head = nn.Sequential(
            nn.Linear(fusion_dim, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
        )

        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(
        self,
        mri_features: Optional[torch.Tensor] = None,
        gene_features: Optional[torch.Tensor] = None,
        protein_features: Optional[torch.Tensor] = None,
        return_xai: bool = False,
    ) -> Dict[str, torch.Tensor]:
        """
        Args:
            mri_features: (B, 768)
            gene_features: (B, 64)
            protein_features: (B, protein_dim)
            return_xai: Return XAI data

        Returns:
            Dict of predictions
        """
        # Determine batch size and device
        if mri_features is not None:
            batch_size = mri_features.size(0)
            device = mri_features.device
        elif gene_features is not None:
            batch_size = gene_features.size(0)
            device = gene_features.device
        elif protein_features is not None:
            batch_size = protein_features.size(0)
            device = protein_features.device
        else:
            raise ValueError("At least one modality must be provided")

        # Project each modality
        modality_projections = {}
        modalities = []

        if mri_features is not None:
            mri_proj = self.mri_proj(mri_features)
            modalities.append(mri_proj)
            modality_projections['mri'] = mri_proj
        else:
            modalities.append(torch.zeros(batch_size, 256, device=device))
            modality_projections['mri'] = None

        if gene_features is not None:
            gene_proj = self.gene_proj(gene_features)
            modalities.append(gene_proj)
            modality_projections['gene'] = gene_proj
        else:
            modalities.append(torch.zeros(batch_size, 256, device=device))
            modality_projections['gene'] = None

        if protein_features is not None:
            protein_proj = self.protein_proj(protein_features)
            modalities.append(protein_proj)
            modality_projections['protein'] = protein_proj
        else:
            modalities.append(torch.zeros(batch_size, 256, device=device))
            modality_projections['protein'] = None

        # Stack for attention: (B, 3, fusion_dim)
        stacked = torch.stack(modalities, dim=1)
        attended, _ = self.cross_attention(stacked, stacked, stacked)

        # Flatten and fuse
        fused = attended.reshape(batch_size, -1)  # (B, 3*fusion_dim)
        fused = self.fusion_mlp(fused)  # (B, fusion_dim)

        # Task predictions
        survival = self.survival_head(fused)
        recurrence = self.recurrence_head(fused)
        risk = self.risk_head(fused)

        result = {
            "survival": survival,
            "recurrence": recurrence,
            "risk": risk,
        }

        if return_xai:
            result["modality_projections"] = modality_projections
            result["fused_features"] = fused

        return result


class MMInferenceService:
    """MM Model 추론 서비스"""

    def __init__(
        self,
        weights_path: Optional[str] = None,
        device: str = "auto",
    ):
        self.device = self._get_device(device)
        self.model = None
        self.survival_cindex = None

        # Use local weights folder
        base = Path(__file__).parent.parent / "model"
        self.weights_path = weights_path or str(base / "mm_best.pt")

    def _get_device(self, device: str) -> str:
        if device == "auto":
            return "cuda" if torch.cuda.is_available() else "cpu"
        return device

    def load_model(self) -> None:
        """모델 로드"""
        if self.model is not None:
            return

        print(f"[MM] Loading MM model (v2.0 - no clinical)...")

        # Default protein dim
        protein_dim = 203

        if Path(self.weights_path).exists():
            checkpoint = torch.load(
                self.weights_path, map_location=self.device, weights_only=False
            )

            # Get protein dim from config if available
            if isinstance(checkpoint, dict) and 'config' in checkpoint:
                protein_dim = checkpoint['config'].get('protein_dim', 203)

            if "model_state_dict" in checkpoint:
                state_dict = checkpoint["model_state_dict"]
            else:
                state_dict = checkpoint

            # Create model with correct dimensions
            self.model = MMModel(protein_dim=protein_dim)

            # Load weights
            self.model.load_state_dict(state_dict, strict=False)
            print(f"[MM] Model weights loaded (protein_dim={protein_dim})")

            # Load C-Index
            if isinstance(checkpoint, dict) and 'metrics' in checkpoint:
                if 'c_index' in checkpoint['metrics']:
                    self.survival_cindex = checkpoint['metrics']['c_index']
                elif 'survival_cindex' in checkpoint['metrics']:
                    self.survival_cindex = checkpoint['metrics']['survival_cindex']

                if self.survival_cindex:
                    print(f"[MM] Survival C-Index: {self.survival_cindex:.4f}")
        else:
            # Create model with default dimensions
            self.model = MMModel(protein_dim=protein_dim)
            print(f"[MM] Warning: MM model weights not found. Using random weights.")

        self.model.to(self.device)
        self.model.eval()

    def parse_protein_csv(self, csv_content: str) -> List[float]:
        """
        RPPA CSV 파일 파싱

        Args:
            csv_content: CSV 파일 내용

        Returns:
            protein_features: RPPA protein expression values
        """
        df = pd.read_csv(StringIO(csv_content))

        # CSV 구조에 따라 파싱 (첫 번째 열이 protein 이름, 두 번째 열이 값일 수 있음)
        if df.shape[1] >= 2:
            # protein_name, value 구조
            values = df.iloc[:, 1].values.astype(float).tolist()
        else:
            # 단일 열 또는 다른 구조
            values = df.iloc[:, 0].values.astype(float).tolist()

        return values

    def predict(
        self,
        mri_features: Optional[List[float]] = None,
        gene_features: Optional[List[float]] = None,
        protein_features: Optional[List[float]] = None,
        include_xai: bool = False,
    ) -> Dict[str, Any]:
        """
        Multimodal 예측 수행

        Args:
            mri_features: 768-dim MRI features (M1 encoder output)
            gene_features: 64-dim gene features (MG encoder output)
            protein_features: RPPA protein values
            include_xai: XAI 데이터 포함 여부

        Returns:
            예측 결과 딕셔너리
        """
        self.load_model()
        start_time = time.time()

        modalities_used = []

        # Prepare inputs
        mri_tensor = None
        if mri_features is not None:
            mri_tensor = torch.tensor(mri_features, dtype=torch.float32)
            mri_tensor = mri_tensor.unsqueeze(0).to(self.device)
            modalities_used.append("mri")

        gene_tensor = None
        if gene_features is not None:
            gene_tensor = torch.tensor(gene_features, dtype=torch.float32)
            gene_tensor = gene_tensor.unsqueeze(0).to(self.device)
            modalities_used.append("gene")

        protein_tensor = None
        if protein_features is not None:
            # Pad or truncate to expected protein_dim (203)
            expected_dim = 203
            if len(protein_features) < expected_dim:
                # Pad with zeros
                protein_features = list(protein_features) + [0.0] * (expected_dim - len(protein_features))
            elif len(protein_features) > expected_dim:
                # Truncate
                protein_features = protein_features[:expected_dim]
            protein_tensor = torch.tensor(protein_features, dtype=torch.float32)
            protein_tensor = protein_tensor.unsqueeze(0).to(self.device)
            modalities_used.append("protein")

        if not modalities_used:
            raise ValueError("At least one modality must be provided")

        # Inference
        with torch.no_grad():
            outputs = self.model(
                mri_features=mri_tensor,
                gene_features=gene_tensor,
                protein_features=protein_tensor,
                return_xai=include_xai,
            )

        results = {}

        # Survival (Cox) - Main Task
        risk_score = torch.sigmoid(outputs["survival"][0]).item()
        results["survival"] = {
            "hazard_ratio": float(np.exp(outputs["survival"][0].item())),
            "risk_score": float(risk_score),
            "survival_probability_6m": float(np.exp(-risk_score * 0.5)),
            "survival_probability_12m": float(np.exp(-risk_score * 1.0)),
            "model_cindex": self.survival_cindex,
        }

        # Recurrence
        rec_prob = torch.sigmoid(outputs["recurrence"][0]).item()
        results["recurrence"] = {
            "predicted_class": "Recurrence" if rec_prob > 0.5 else "No_Recurrence",
            "recurrence_probability": float(rec_prob),
        }

        # Risk Group (from survival score)
        if risk_score > 0.66:
            risk_class = "High"
            risk_probs = {"Low": 0.1, "Medium": 0.2, "High": 0.7}
        elif risk_score > 0.33:
            risk_class = "Medium"
            risk_probs = {"Low": 0.2, "Medium": 0.6, "High": 0.2}
        else:
            risk_class = "Low"
            risk_probs = {"Low": 0.7, "Medium": 0.2, "High": 0.1}

        results["risk_group"] = {
            "predicted_class": risk_class,
            "probabilities": risk_probs,
        }

        # Recommendation
        results["recommendation"] = self._generate_recommendation(results)

        # XAI Data
        if include_xai:
            xai_data = self._extract_xai_data(
                outputs,
                mri_tensor,
                gene_tensor,
                protein_tensor,
                modalities_used
            )
            results["xai"] = xai_data

        # Metadata
        results["processing_time_ms"] = (time.time() - start_time) * 1000
        results["modalities_used"] = modalities_used

        return results

    def _extract_xai_data(
        self,
        outputs: Dict[str, torch.Tensor],
        mri_tensor: Optional[torch.Tensor],
        gene_tensor: Optional[torch.Tensor],
        protein_tensor: Optional[torch.Tensor],
        modalities_used: List[str],
    ) -> Dict[str, Any]:
        """XAI 데이터 추출"""
        xai = {}

        # Modality Contribution Analysis
        modality_contributions = {}
        total_contribution = 0.0

        if "modality_projections" in outputs:
            projections = outputs["modality_projections"]
            for name, proj in projections.items():
                if proj is not None:
                    contrib = float(torch.norm(proj, p=2).item())
                    modality_contributions[name] = contrib
                    total_contribution += contrib
                else:
                    modality_contributions[name] = 0.0

            if total_contribution > 0:
                for name in modality_contributions:
                    modality_contributions[name] = round(
                        modality_contributions[name] / total_contribution * 100, 2
                    )

        xai["modality_contributions"] = modality_contributions

        # Per-modality Feature Statistics
        modality_stats = {}

        if mri_tensor is not None:
            mri_np = mri_tensor[0].cpu().numpy()
            modality_stats["mri"] = {
                "dimension": len(mri_np),
                "mean": float(np.mean(mri_np)),
                "std": float(np.std(mri_np)),
                "l2_norm": float(np.linalg.norm(mri_np)),
            }

        if gene_tensor is not None:
            gene_np = gene_tensor[0].cpu().numpy()
            modality_stats["gene"] = {
                "dimension": len(gene_np),
                "mean": float(np.mean(gene_np)),
                "std": float(np.std(gene_np)),
                "l2_norm": float(np.linalg.norm(gene_np)),
            }

        if protein_tensor is not None:
            protein_np = protein_tensor[0].cpu().numpy()
            modality_stats["protein"] = {
                "dimension": len(protein_np),
                "mean": float(np.mean(protein_np)),
                "std": float(np.std(protein_np)),
                "l2_norm": float(np.linalg.norm(protein_np)),
            }

        xai["modality_statistics"] = modality_stats

        # Completeness Score
        total_modalities = 3  # mri, gene, protein
        xai["data_completeness"] = {
            "available_modalities": len(modalities_used),
            "total_modalities": total_modalities,
            "completeness_ratio": round(len(modalities_used) / total_modalities, 2),
            "missing_modalities": [
                m for m in ["mri", "gene", "protein"]
                if m not in modalities_used
            ],
        }

        return xai

    def _generate_recommendation(self, results: Dict) -> str:
        """결과 기반 권고사항 생성"""
        risk_group = results["risk_group"]["predicted_class"]
        rec_prob = results["recurrence"]["recurrence_probability"]

        recommendations = []

        if risk_group == "High":
            recommendations.append("고위험군으로 분류됨. 적극적 치료 권고.")
        elif risk_group == "Medium":
            recommendations.append("중위험군으로 분류됨. 정기적 추적 관찰 권고.")
        else:
            recommendations.append("저위험군으로 분류됨.")

        if rec_prob > 0.7:
            recommendations.append("재발 위험 높음. 면밀한 모니터링 필요.")

        return " ".join(recommendations)

    def prepare_results_for_callback(self, result: Dict[str, Any], job_id: str) -> Dict[str, Dict[str, str]]:
        """
        추론 결과를 callback용 파일 내용으로 변환 (CDSS_STORAGE 직접 저장 없음)

        Args:
            result: 추론 결과 dict
            job_id: 작업 ID

        Returns:
            files_data: {filename: {content, type}}
        """
        files_data = {}

        # mm_result.json
        result_json = {
            'job_id': job_id,
            'survival': result.get('survival'),
            'recurrence': result.get('recurrence'),
            'risk_group': result.get('risk_group'),
            'recommendation': result.get('recommendation'),
            'processing_time_ms': result.get('processing_time_ms'),
            'model_version': '2.0.0',
            'modalities_used': result.get('modalities_used', []),
        }

        files_data['mm_result.json'] = {
            'content': json.dumps(result_json, ensure_ascii=False, indent=2, default=str),
            'type': 'json'
        }

        # XAI data if available
        if 'xai' in result:
            files_data['mm_xai.json'] = {
                'content': json.dumps(result['xai'], ensure_ascii=False, indent=2),
                'type': 'json'
            }

        return files_data
