"""
MG Model Inference Service

Gene Expression 기반 예측 서비스
- 생존 위험도 (Survival Risk)
- 예측 생존 기간 (Survival Time)
- 종양 등급 (Grade: LGG/HGG)
- 재발 예측 (Recurrence)
- TMZ 치료 반응 (TMZ Response)
"""
import time
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, Optional, List
import base64
from io import BytesIO

from config import settings


class MGInferenceService:
    """MG Model 추론 서비스"""

    GRADE_CLASSES = ['Grade II', 'Grade III', 'Grade IV']
    MODEL_CINDEX = 0.7807  # Validation C-Index

    def __init__(self, device: str = None):
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.gene_list = []
        self.n_genes = 2000
        self.n_deg_clusters = 4
        self.emb_dim = 64

        # Survival time normalization
        self.surv_time_mean = 6.654
        self.surv_time_std = 1.110

        # Weights path
        self.weights_path = settings.MODEL_DIR / "mg_4tasks_best.pt"

        # DEG genes
        self.deg_up_genes = {}
        self.deg_down_genes = {}

    def load_csv(self, csv_path: str) -> Dict[str, Any]:
        """
        Gene Expression CSV 파일 로드

        CSV 형식 (3열):
        - Hugo_Symbol: Gene name
        - Entrez_Gene_Id: Gene ID (사용 안 함)
        - Expression: Expression value

        CSV 형식 (2열):
        - 첫 번째 열: Gene name
        - 두 번째 열: Expression value

        Returns:
            Dict with gene_expression, gene_names, gene_count
        """
        df = pd.read_csv(csv_path)

        # 'Expression' 열이 있는 경우 (3열 형식: Hugo_Symbol, Entrez_Gene_Id, Expression)
        if 'Expression' in df.columns:
            gene_names = df['Hugo_Symbol'].astype(str).tolist() if 'Hugo_Symbol' in df.columns else df.iloc[:, 0].astype(str).tolist()
            gene_expression = df['Expression'].astype(float).tolist()
        elif df.shape[1] >= 3:
            # 3열 이상이면 첫 번째 열 = gene name, 마지막 열 = expression
            gene_names = df.iloc[:, 0].astype(str).tolist()
            gene_expression = df.iloc[:, -1].astype(float).tolist()
        elif df.shape[1] >= 2:
            # 2열이면 첫 번째 = gene name, 두 번째 = expression
            gene_names = df.iloc[:, 0].astype(str).tolist()
            gene_expression = df.iloc[:, 1].astype(float).tolist()
        else:
            # 단일 열인 경우 값만 사용
            gene_names = [f"Gene_{i}" for i in range(len(df))]
            gene_expression = df.iloc[:, 0].astype(float).tolist()

        return {
            'gene_names': gene_names,
            'gene_expression': gene_expression,
            'gene_count': len(gene_expression),
        }

    def load_csv_content(self, csv_content: str) -> Dict[str, Any]:
        """
        CSV 내용(문자열)에서 Gene Expression 데이터 파싱

        Args:
            csv_content: CSV 파일 내용 (문자열)

        CSV 형식 (3열):
        - Hugo_Symbol: Gene name
        - Entrez_Gene_Id: Gene ID (사용 안 함)
        - Expression: Expression value

        Returns:
            Dict with gene_expression, gene_names, gene_count
        """
        from io import StringIO

        df = pd.read_csv(StringIO(csv_content))

        # 'Expression' 열이 있는 경우 (3열 형식: Hugo_Symbol, Entrez_Gene_Id, Expression)
        if 'Expression' in df.columns:
            gene_names = df['Hugo_Symbol'].astype(str).tolist() if 'Hugo_Symbol' in df.columns else df.iloc[:, 0].astype(str).tolist()
            gene_expression = df['Expression'].astype(float).tolist()
        elif df.shape[1] >= 3:
            # 3열 이상이면 첫 번째 열 = gene name, 마지막 열 = expression
            gene_names = df.iloc[:, 0].astype(str).tolist()
            gene_expression = df.iloc[:, -1].astype(float).tolist()
        elif df.shape[1] >= 2:
            # 2열이면 첫 번째 = gene name, 두 번째 = expression
            gene_names = df.iloc[:, 0].astype(str).tolist()
            gene_expression = df.iloc[:, 1].astype(float).tolist()
        else:
            # 단일 열인 경우 값만 사용
            gene_names = [f"Gene_{i}" for i in range(len(df))]
            gene_expression = df.iloc[:, 0].astype(float).tolist()

        return {
            'gene_names': gene_names,
            'gene_expression': gene_expression,
            'gene_count': len(gene_expression),
        }

    def load_model(self) -> None:
        """모델 로드"""
        if self.model is not None:
            return

        print(f"Loading MG model from {self.weights_path}...")

        if not self.weights_path.exists():
            print(f"  Warning: Model weights not found at {self.weights_path}")
            print(f"  Using random initialization for testing")
            gene_embeddings = torch.randn(self.n_genes, self.emb_dim)
            self.model = self._create_model(gene_embeddings)
        else:
            checkpoint = torch.load(
                self.weights_path,
                map_location=self.device,
                weights_only=False
            )

            # Gene embeddings
            if 'gene_embeddings' in checkpoint:
                gene_embeddings = torch.from_numpy(checkpoint['gene_embeddings']).float()
            else:
                gene_embeddings = torch.randn(self.n_genes, self.emb_dim)

            # Gene list
            if 'top_genes' in checkpoint:
                self.gene_list = checkpoint['top_genes']
            else:
                self.gene_list = [f'Gene_{i}' for i in range(self.n_genes)]

            # Create model
            self.model = self._create_model(gene_embeddings)

            # Load state dict
            if 'model_state_dict' in checkpoint:
                self.model.load_state_dict(checkpoint['model_state_dict'], strict=True)
                print("  Model weights loaded successfully")

        self.model.to(self.device)
        self.model.eval()
        print(f"  MG Model ready on {self.device}")

    def _create_model(self, gene_embeddings: torch.Tensor) -> nn.Module:
        """Create MG model architecture"""

        class Gene2VecEncoder(nn.Module):
            def __init__(self, gene_embeddings, emb_dim=64, dropout=0.4):
                super().__init__()
                self.gene_emb = nn.Parameter(gene_embeddings.clone(), requires_grad=False)
                self.attention = nn.Sequential(
                    nn.Linear(emb_dim, 32),
                    nn.Tanh(),
                    nn.Dropout(dropout * 0.3),
                    nn.Linear(32, 1)
                )
                self.encoder = nn.Sequential(
                    nn.Linear(emb_dim, 112),
                    nn.LayerNorm(112),
                    nn.GELU(),
                    nn.Dropout(dropout),
                    nn.Linear(112, 64),
                    nn.LayerNorm(64),
                    nn.GELU(),
                    nn.Dropout(dropout * 0.5)
                )
                self.output_dim = 64

            def forward(self, expr, return_attention=False):
                batch_size = expr.shape[0]
                weighted_emb = expr.unsqueeze(-1) * self.gene_emb.unsqueeze(0)
                attn_scores = self.attention(self.gene_emb.unsqueeze(0).expand(batch_size, -1, -1))
                attn_weights = F.softmax(attn_scores, dim=1)
                pooled = (weighted_emb * attn_weights).sum(dim=1)
                z = self.encoder(pooled)
                return {'z': z, 'attention_weights': attn_weights.squeeze(-1) if return_attention else None}

        class DEGEncoder(nn.Module):
            def __init__(self, n_clusters=4, dropout=0.3):
                super().__init__()
                self.encoder = nn.Sequential(
                    nn.Linear(n_clusters, 24),
                    nn.LayerNorm(24),
                    nn.GELU(),
                    nn.Dropout(dropout),
                    nn.Linear(24, 16),
                    nn.LayerNorm(16)
                )
                self.output_dim = 16

            def forward(self, deg_scores):
                return {'encoded': self.encoder(deg_scores)}

        class GeneExpressionCDSS(nn.Module):
            def __init__(self, gene_embeddings, n_deg=4, dropout=0.38):
                super().__init__()
                self.gene_encoder = Gene2VecEncoder(gene_embeddings, emb_dim=gene_embeddings.shape[1], dropout=dropout)
                self.deg_encoder = DEGEncoder(n_deg, dropout=dropout * 0.75)
                fusion_dim = self.gene_encoder.output_dim + self.deg_encoder.output_dim
                self.fusion = nn.Sequential(
                    nn.Linear(fusion_dim, 48),
                    nn.LayerNorm(48),
                    nn.GELU(),
                    nn.Dropout(dropout)
                )
                self.risk_head = nn.Linear(48, 1)
                self.grade_head = nn.Linear(48, 3)
                self.surv_time_head = nn.Linear(48, 1)
                self.recurrence_head = nn.Linear(48, 1)

            def forward(self, gene_expression, deg_scores, return_explainability=False):
                gene_out = self.gene_encoder(gene_expression, return_attention=return_explainability)
                deg_out = self.deg_encoder(deg_scores)
                fused = torch.cat([gene_out['z'], deg_out['encoded']], dim=-1)
                shared = self.fusion(fused)
                result = {
                    'risk': self.risk_head(shared).squeeze(-1),
                    'grade_logits': self.grade_head(shared),
                    'surv_time': self.surv_time_head(shared).squeeze(-1),
                    'recurrence': self.recurrence_head(shared).squeeze(-1),
                    'gene_latent': gene_out['z'],
                    'deg_encoded': deg_out['encoded']
                }
                if return_explainability:
                    result['attention_weights'] = gene_out['attention_weights']
                return result

        return GeneExpressionCDSS(gene_embeddings, self.n_deg_clusters)

    def preprocess(self, gene_expr: List[float], gene_names: Optional[List[str]] = None) -> tuple:
        """Gene expression 전처리"""
        expr = np.array(gene_expr, dtype=np.float32)

        # 2000 genes로 맞춤
        if len(expr) > self.n_genes:
            expr = expr[:self.n_genes]
        elif len(expr) < self.n_genes:
            padded = np.zeros(self.n_genes, dtype=np.float32)
            padded[:len(expr)] = expr
            expr = padded

        # Log2 transform
        if expr.max() > 100:
            expr = np.log2(expr + 1)

        # Z-score normalize
        mean = expr.mean()
        std = expr.std()
        if std > 0:
            expr = (expr - mean) / std

        # DEG scores (zeros for now, can be computed if DEG genes are loaded)
        deg_scores = np.zeros(self.n_deg_clusters, dtype=np.float32)

        expr_tensor = torch.from_numpy(expr).float().unsqueeze(0).to(self.device)
        deg_tensor = torch.from_numpy(deg_scores).float().unsqueeze(0).to(self.device)

        return expr_tensor, deg_tensor

    def predict(
        self,
        gene_expression: List[float],
        gene_names: Optional[List[str]] = None,
        include_visualizations: bool = False,
        include_xai: bool = True
    ) -> Dict[str, Any]:
        """
        Gene expression 예측 수행

        Args:
            gene_expression: Gene expression 값 리스트
            gene_names: Gene name 리스트
            include_visualizations: 시각화 생성 여부
            include_xai: XAI 데이터 포함 여부

        Returns:
            예측 결과 딕셔너리
        """
        self.load_model()
        start_time = time.time()

        # Preprocess
        expr_tensor, deg_tensor = self.preprocess(gene_expression, gene_names)

        # Inference with explainability
        with torch.no_grad():
            outputs = self.model(expr_tensor, deg_tensor, return_explainability=include_xai)

        results = {}

        # Survival Risk
        risk_score = outputs["risk"].item()
        results["survival_risk"] = {
            "risk_score": float(risk_score),
            "risk_category": "High" if risk_score > 0 else "Low",
            "risk_percentile": float(50 + risk_score * 25),
            "model_cindex": self.MODEL_CINDEX,
        }

        # Survival Time
        surv_time_norm = outputs["surv_time"].item()
        surv_time_log = surv_time_norm * self.surv_time_std + self.surv_time_mean
        surv_time_days = max(0, np.expm1(surv_time_log))
        results["survival_time"] = {
            "predicted_days": int(surv_time_days),
            "predicted_months": float(surv_time_days / 30.44),
        }

        # Grade
        grade_probs = F.softmax(outputs["grade_logits"], dim=-1).squeeze().cpu().numpy()
        grade_idx = int(np.argmax(grade_probs))
        lgg_prob = float(grade_probs[0] + grade_probs[1])
        hgg_prob = float(grade_probs[2])
        results["grade"] = {
            "predicted_class": self.GRADE_CLASSES[grade_idx],
            "probability": float(grade_probs[grade_idx]),
            "lgg_probability": lgg_prob,
            "hgg_probability": hgg_prob,
            "probabilities": {
                cls: float(p) for cls, p in zip(self.GRADE_CLASSES, grade_probs)
            }
        }

        # Recurrence
        rec_prob = torch.sigmoid(outputs["recurrence"]).item()
        results["recurrence"] = {
            "predicted_class": "Recurrence" if rec_prob > 0.5 else "No_Recurrence",
            "probability": float(rec_prob if rec_prob > 0.5 else 1 - rec_prob),
            "recurrence_probability": float(rec_prob),
        }

        # TMZ Response (estimated from expression)
        results["tmz_response"] = self._estimate_tmz_response(gene_expression, gene_names)

        # Encoder features
        results["encoder_features"] = outputs["gene_latent"].squeeze().cpu().numpy().tolist()

        # XAI Data
        if include_xai and outputs.get("attention_weights") is not None:
            results["xai"] = self._generate_xai_data(
                outputs["attention_weights"],
                gene_expression,
                gene_names,
                deg_tensor,
                outputs.get("deg_encoded")
            )

        # Visualizations
        if include_visualizations:
            results["visualizations"] = self._create_visualizations(results)

        # Metadata
        results["processing_time_ms"] = (time.time() - start_time) * 1000
        results["input_genes_count"] = len(gene_expression)
        results["model_version"] = "1.0.0"

        return results

    def _estimate_tmz_response(
        self,
        gene_expression: List[float],
        gene_names: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """TMZ 치료 반응 추정 (MGMT 발현 기반)"""
        if gene_names is None:
            return {
                "predicted_class": "Unknown",
                "probability": 0.5,
                "responder_probability": 0.5,
                "mgmt_status": "Unknown",
                "confidence": 0.0,
                "method": "no_gene_names"
            }

        # Find MGMT gene
        mgmt_idx = None
        for i, name in enumerate(gene_names):
            if name.upper() == 'MGMT':
                mgmt_idx = i
                break

        if mgmt_idx is not None and mgmt_idx < len(gene_expression):
            expr_np = np.array(gene_expression, dtype=np.float32)
            if expr_np.max() > 100:
                expr_np = np.log2(expr_np + 1)
            mean_expr = np.mean(expr_np)
            std_expr = np.std(expr_np)
            if std_expr > 0:
                mgmt_zscore = (expr_np[mgmt_idx] - mean_expr) / std_expr
            else:
                mgmt_zscore = 0.0

            methylation_prob = 1 / (1 + np.exp(mgmt_zscore))

            if methylation_prob > 0.6:
                mgmt_status = 'Methylated'
                tmz_response = 'Likely Responsive'
            elif methylation_prob < 0.4:
                mgmt_status = 'Unmethylated'
                tmz_response = 'Likely Resistant'
            else:
                mgmt_status = 'Intermediate'
                tmz_response = 'Uncertain'

            return {
                "predicted_class": tmz_response,
                "probability": float(max(methylation_prob, 1 - methylation_prob)),
                "responder_probability": float(methylation_prob),
                "mgmt_status": mgmt_status,
                "mgmt_methylation_probability": float(methylation_prob),
                "confidence": float(abs(methylation_prob - 0.5) * 2),
                "method": "MGMT_expression_based"
            }
        else:
            return {
                "predicted_class": "Unknown",
                "probability": 0.5,
                "responder_probability": 0.5,
                "mgmt_status": "Unknown",
                "confidence": 0.0,
                "method": "MGMT_not_found"
            }

    def _generate_xai_data(
        self,
        attention_weights: torch.Tensor,
        gene_expression: List[float],
        gene_names: Optional[List[str]],
        deg_tensor: torch.Tensor,
        deg_encoded: Optional[torch.Tensor]
    ) -> Dict[str, Any]:
        """XAI 데이터 생성"""
        xai_data = {}

        # Attention weights
        attn_np = attention_weights.squeeze().cpu().numpy()
        xai_data["attention_weights"] = attn_np.tolist()

        # Expression array
        expr_np = np.array(gene_expression, dtype=np.float32)
        if expr_np.max() > 100:
            expr_np = np.log2(expr_np + 1)
        mean_expr = np.mean(expr_np)
        std_expr = np.std(expr_np)
        if std_expr > 0:
            expr_zscore = (expr_np - mean_expr) / std_expr
        else:
            expr_zscore = np.zeros_like(expr_np)

        # Top genes by attention
        n_top = min(20, len(attn_np))
        top_indices = np.argsort(attn_np)[-n_top:][::-1]

        top_genes = []
        for rank, idx in enumerate(top_indices, 1):
            gene_name = gene_names[idx] if gene_names and idx < len(gene_names) else f"Gene_{idx}"
            zscore = float(expr_zscore[idx]) if idx < len(expr_zscore) else 0.0
            top_genes.append({
                "rank": rank,
                "gene": gene_name,
                "attention_score": float(attn_np[idx]),
                "expression_zscore": zscore
            })
        xai_data["top_genes"] = top_genes

        # Gene importance summary
        xai_data["gene_importance_summary"] = {
            "total_genes": len(attn_np),
            "attention_mean": float(np.mean(attn_np)),
            "attention_std": float(np.std(attn_np)),
            "attention_max": float(np.max(attn_np)),
            "attention_min": float(np.min(attn_np))
        }

        # DEG cluster scores (placeholder - real implementation would use actual DEG clusters)
        deg_scores = deg_tensor.squeeze().cpu().numpy()
        deg_clusters = {}
        cluster_names = ["Immune_Response", "Cell_Cycle", "Metabolism", "Signaling"]
        for i, name in enumerate(cluster_names):
            if i < len(deg_scores):
                deg_clusters[name] = {
                    "score": float(deg_scores[i]),
                    "up_genes_count": int(np.random.randint(10, 50)),  # Placeholder
                    "down_genes_count": int(np.random.randint(5, 30))  # Placeholder
                }
        xai_data["deg_cluster_scores"] = deg_clusters

        # DEG encoded features
        if deg_encoded is not None:
            xai_data["deg_encoded_features"] = deg_encoded.squeeze().cpu().numpy().tolist()

        # Expression stats
        xai_data["expression_stats"] = {
            "mean": float(np.mean(expr_np)),
            "std": float(np.std(expr_np)),
            "min": float(np.min(expr_np)),
            "max": float(np.max(expr_np)),
            "nonzero_count": int(np.count_nonzero(expr_np)),
            "positive_count": int(np.sum(expr_zscore > 0)),
            "negative_count": int(np.sum(expr_zscore < 0))
        }

        return xai_data

    def _create_visualizations(self, results: Dict[str, Any]) -> Dict[str, str]:
        """시각화 생성 (base64 PNG)"""
        try:
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt

            visualizations = {}

            # 1. Grade Chart
            fig, ax = plt.subplots(figsize=(6, 4))
            grade = results.get('grade', {})
            probs = grade.get('probabilities', {})
            if probs:
                classes = list(probs.keys())
                values = list(probs.values())
                colors = ['#4CAF50', '#FFC107', '#F44336']
                ax.barh(classes, values, color=colors)
                ax.set_xlim(0, 1)
                ax.set_xlabel('Probability')
                ax.set_title('Tumor Grade Prediction')
                for i, v in enumerate(values):
                    ax.text(v + 0.02, i, f'{v*100:.1f}%', va='center')
            buf = BytesIO()
            plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            buf.seek(0)
            visualizations['grade_chart'] = base64.b64encode(buf.read()).decode('ascii')
            plt.close(fig)

            # 2. Risk Gauge
            fig, ax = plt.subplots(figsize=(6, 3))
            risk = results.get('survival_risk', {})
            risk_score = risk.get('risk_score', 0)
            risk_normalized = (risk_score + 2) / 4  # Normalize to 0-1
            risk_normalized = max(0, min(1, risk_normalized))

            ax.barh(['Risk'], [1], color='#E0E0E0', height=0.5)
            color = '#4CAF50' if risk_normalized < 0.33 else '#FFC107' if risk_normalized < 0.66 else '#F44336'
            ax.barh(['Risk'], [risk_normalized], color=color, height=0.5)
            ax.axvline(x=0.33, color='gray', linestyle='--', alpha=0.5)
            ax.axvline(x=0.66, color='gray', linestyle='--', alpha=0.5)
            ax.set_xlim(0, 1)
            ax.set_title(f'Survival Risk: {risk.get("risk_category", "Unknown")}')
            buf = BytesIO()
            plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            buf.seek(0)
            visualizations['risk_gauge'] = base64.b64encode(buf.read()).decode('ascii')
            plt.close(fig)

            # 3. Recurrence Chart
            fig, ax = plt.subplots(figsize=(5, 4))
            rec = results.get('recurrence', {})
            rec_prob = rec.get('recurrence_probability', 0.5)
            sizes = [rec_prob, 1 - rec_prob]
            labels = ['Recurrence', 'No Recurrence']
            colors = ['#F44336', '#4CAF50']
            ax.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90)
            ax.set_title('Recurrence Prediction')
            buf = BytesIO()
            plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            buf.seek(0)
            visualizations['recurrence_chart'] = base64.b64encode(buf.read()).decode('ascii')
            plt.close(fig)

            return visualizations

        except Exception as e:
            print(f"Visualization error: {e}")
            return {}
