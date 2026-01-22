"""
M1-Cls Inference Script

Colab에서 학습한 M1-Cls 모델을 이용한 추론
- Input: 4채널 MRI (T1, T1ce, T2, FLAIR) - .pt 또는 NIfTI
- Output: Grade, IDH, MGMT, Survival Risk, OS Days

Usage:
    python m1_cls_inference.py --input patient.pt --weights M1_Cls_best.pth
"""

import os
import sys
import argparse
from pathlib import Path
from typing import Dict, Any, Optional, Union

import torch
import torch.nn as nn
import numpy as np

# MONAI for SwinUNETR
try:
    from monai.networks.nets import SwinUNETR
except ImportError:
    print("MONAI required: pip install monai")
    sys.exit(1)


class M1ClsModel(nn.Module):
    """M1-Cls: SwinUNETR encoder + 5 task heads"""

    def __init__(self, feature_size=48):
        super().__init__()

        self.backbone = SwinUNETR(
            in_channels=4,
            out_channels=4,
            feature_size=feature_size,
            use_checkpoint=False,  # Inference에서는 False
            spatial_dims=3
        )

        self.global_pool = nn.AdaptiveAvgPool3d(1)
        encoder_dim = feature_size * 16  # 768

        # Task heads
        self.grade_head = nn.Sequential(
            nn.Linear(encoder_dim, 256), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(256, 3)
        )
        self.idh_head = nn.Sequential(
            nn.Linear(encoder_dim, 128), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, 1)
        )
        self.mgmt_head = nn.Sequential(
            nn.Linear(encoder_dim, 128), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, 1)
        )
        self.survival_head = nn.Sequential(
            nn.Linear(encoder_dim, 128), nn.ReLU(), nn.Dropout(0.4),
            nn.Linear(128, 64), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(64, 1)
        )
        self.os_days_head = nn.Sequential(
            nn.Linear(encoder_dim, 256), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(256, 128), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(128, 1)
        )

        self.encoder_features = None
        self._register_hooks()

    def _register_hooks(self):
        def hook(module, input, output):
            self.encoder_features = output
        if hasattr(self.backbone, 'encoder10'):
            self.backbone.encoder10.register_forward_hook(hook)

    def forward(self, x):
        _ = self.backbone(x)
        features = self.global_pool(self.encoder_features)
        features = features.view(features.size(0), -1)

        return {
            'grade_logits': self.grade_head(features),
            'idh_logits': self.idh_head(features),
            'mgmt_logits': self.mgmt_head(features),
            'survival_risk': self.survival_head(features).squeeze(-1),
            'os_days_pred': self.os_days_head(features).squeeze(-1),
        }

    def get_encoder_features(self, x) -> torch.Tensor:
        """MM 모델용 768-dim encoder features 추출"""
        _ = self.backbone(x)
        features = self.global_pool(self.encoder_features)
        return features.view(features.size(0), -1)


class M1ClsInference:
    """M1-Cls 추론 클래스"""

    GRADE_CLASSES = ['Grade II', 'Grade III', 'Grade IV']
    IDH_CLASSES = ['Wildtype', 'Mutant']
    MGMT_CLASSES = ['Unmethylated', 'Methylated']

    def __init__(
        self,
        weights_path: Optional[str] = None,
        device: str = "auto"
    ):
        self.device = self._get_device(device)
        self.model = None

        # Default weights path
        base = Path(__file__).parent.parent / "weights"
        self.weights_path = weights_path or str(base / "M1_Cls_best.pth")

    def _get_device(self, device: str) -> str:
        if device == "auto":
            return "cuda" if torch.cuda.is_available() else "cpu"
        return device

    def load_model(self) -> None:
        """모델 로드"""
        if self.model is not None:
            return

        print(f"Loading M1-Cls model...")
        print(f"   Weights: {self.weights_path}")
        print(f"   Device: {self.device}")

        self.model = M1ClsModel()

        if Path(self.weights_path).exists():
            checkpoint = torch.load(
                self.weights_path,
                map_location=self.device,
                weights_only=False
            )

            if 'model_state_dict' in checkpoint:
                self.model.load_state_dict(checkpoint['model_state_dict'], strict=False)
                print(f"   Loaded checkpoint (Fold {checkpoint.get('fold', '?')+1}, "
                      f"Score: {checkpoint.get('best_score', 0):.4f})")
            else:
                self.model.load_state_dict(checkpoint, strict=False)
                print("   Loaded weights directly")
        else:
            print(f"   Warning: Weights not found at {self.weights_path}")

        self.model.to(self.device)
        self.model.eval()
        print("   Model ready!")

    def load_input(self, input_path: str) -> torch.Tensor:
        """입력 데이터 로드 (.pt 또는 NIfTI)"""
        input_path = Path(input_path)

        if input_path.suffix == '.pt':
            # .pt 파일 (전처리된 데이터)
            data = torch.load(input_path, weights_only=False)
            if isinstance(data, dict) and 'image' in data:
                image = data['image']
            else:
                image = data
        elif input_path.suffix in ['.nii', '.gz']:
            # NIfTI 파일
            import nibabel as nib
            nii = nib.load(str(input_path))
            image = torch.from_numpy(nii.get_fdata().astype(np.float32))
            # Add channel dim if needed
            if image.ndim == 3:
                image = image.unsqueeze(0)
        else:
            raise ValueError(f"Unsupported format: {input_path.suffix}")

        # Ensure correct shape: (C, H, W, D) -> (1, C, H, W, D)
        if image.ndim == 4:
            image = image.unsqueeze(0)

        return image.to(self.device)

    def predict(
        self,
        input_data: Union[str, torch.Tensor, np.ndarray]
    ) -> Dict[str, Any]:
        """
        추론 수행

        Args:
            input_data: 파일 경로, torch.Tensor, 또는 numpy array

        Returns:
            예측 결과 딕셔너리
        """
        self.load_model()

        # Load input
        if isinstance(input_data, str):
            image = self.load_input(input_data)
        elif isinstance(input_data, np.ndarray):
            image = torch.from_numpy(input_data).float()
            if image.ndim == 4:
                image = image.unsqueeze(0)
            image = image.to(self.device)
        else:
            image = input_data.to(self.device)
            if image.ndim == 4:
                image = image.unsqueeze(0)

        # Inference
        with torch.no_grad():
            outputs = self.model(image)

        # Parse results
        results = {}

        # Grade (3-class)
        grade_probs = torch.softmax(outputs['grade_logits'][0], dim=0).cpu().numpy()
        grade_pred = int(np.argmax(grade_probs))
        results['grade'] = {
            'predicted_class': self.GRADE_CLASSES[grade_pred],
            'predicted_value': grade_pred + 2,  # WHO Grade 2,3,4
            'probability': float(grade_probs[grade_pred]),
            'probabilities': {
                self.GRADE_CLASSES[i]: float(grade_probs[i])
                for i in range(3)
            }
        }

        # IDH (Binary)
        idh_prob = torch.sigmoid(outputs['idh_logits'][0]).item()
        idh_pred = 1 if idh_prob > 0.5 else 0
        results['idh'] = {
            'predicted_class': self.IDH_CLASSES[idh_pred],
            'mutant_probability': float(idh_prob),
        }

        # MGMT (Binary)
        mgmt_prob = torch.sigmoid(outputs['mgmt_logits'][0]).item()
        mgmt_pred = 1 if mgmt_prob > 0.5 else 0
        results['mgmt'] = {
            'predicted_class': self.MGMT_CLASSES[mgmt_pred],
            'methylated_probability': float(mgmt_prob),
        }

        # Survival Risk
        risk_score = outputs['survival_risk'][0].item()
        results['survival'] = {
            'risk_score': float(risk_score),
            'risk_category': 'High' if risk_score > 0.5 else ('Medium' if risk_score > 0 else 'Low'),
        }

        # OS Days
        log_days = outputs['os_days_pred'][0].item()
        pred_days = int(np.exp(log_days) - 1)
        results['os_days'] = {
            'predicted_days': max(0, pred_days),
            'predicted_months': max(0, pred_days / 30.44),
        }

        return results

    def get_encoder_features(
        self,
        input_data: Union[str, torch.Tensor, np.ndarray]
    ) -> np.ndarray:
        """
        MM 모델용 768-dim encoder features 추출
        """
        self.load_model()

        # Load input
        if isinstance(input_data, str):
            image = self.load_input(input_data)
        elif isinstance(input_data, np.ndarray):
            image = torch.from_numpy(input_data).float()
            if image.ndim == 4:
                image = image.unsqueeze(0)
            image = image.to(self.device)
        else:
            image = input_data.to(self.device)
            if image.ndim == 4:
                image = image.unsqueeze(0)

        with torch.no_grad():
            features = self.model.get_encoder_features(image)

        return features.cpu().numpy()


def main():
    parser = argparse.ArgumentParser(description='M1-Cls Inference')
    parser.add_argument('--input', '-i', type=str, required=True,
                        help='Input file (.pt or .nii.gz)')
    parser.add_argument('--weights', '-w', type=str, default=None,
                        help='Model weights path')
    parser.add_argument('--device', '-d', type=str, default='auto',
                        help='Device (cuda/cpu/auto)')
    parser.add_argument('--output', '-o', type=str, default=None,
                        help='Output JSON path (optional)')

    args = parser.parse_args()

    # Inference
    model = M1ClsInference(weights_path=args.weights, device=args.device)
    results = model.predict(args.input)

    # Print results
    print("\n" + "="*50)
    print("M1-Cls Prediction Results")
    print("="*50)
    print(f"Input: {args.input}")
    print()
    print(f"Grade: {results['grade']['predicted_class']} "
          f"({results['grade']['probability']:.1%})")
    print(f"IDH: {results['idh']['predicted_class']} "
          f"(Mutant prob: {results['idh']['mutant_probability']:.1%})")
    print(f"MGMT: {results['mgmt']['predicted_class']} "
          f"(Methylated prob: {results['mgmt']['methylated_probability']:.1%})")
    print(f"Survival Risk: {results['survival']['risk_category']} "
          f"(Score: {results['survival']['risk_score']:.3f})")
    print(f"OS Days: {results['os_days']['predicted_days']} days "
          f"({results['os_days']['predicted_months']:.1f} months)")

    # Save to JSON if requested
    if args.output:
        import json
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\nSaved to: {args.output}")


if __name__ == "__main__":
    main()
