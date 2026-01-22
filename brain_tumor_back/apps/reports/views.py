import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Q
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

from .models import FinalReport, ReportAttachment, ReportLog
from .serializers import (
    FinalReportListSerializer,
    FinalReportDetailSerializer,
    FinalReportCreateSerializer,
    FinalReportUpdateSerializer,
)
from apps.common.permission import IsDoctorOrAdmin
from apps.ocs.models import OCS
from apps.ai_inference.models import AIInference

logger = logging.getLogger(__name__)


@extend_schema(tags=["Reports"])
class FinalReportListCreateView(APIView):
    """최종 보고서 목록 조회 / 생성"""

    def get_permissions(self):
        # GET(조회)는 모든 인증된 사용자 허용, POST(생성)는 의사/관리자만 허용
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsDoctorOrAdmin()]

    @extend_schema(
        summary="보고서 목록 조회",
        description="최종 진료 보고서 목록을 조회합니다.",
        parameters=[
            OpenApiParameter(name='patient_id', type=int, description='환자 ID로 필터링'),
            OpenApiParameter(name='status', type=str, description='상태로 필터링'),
            OpenApiParameter(name='report_type', type=str, description='보고서 유형으로 필터링'),
        ],
        responses={200: FinalReportListSerializer(many=True)},
    )
    def get(self, request):
        queryset = FinalReport.objects.filter(is_deleted=False)

        # 필터링
        patient_id = request.query_params.get('patient_id')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)

        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        report_type = request.query_params.get('report_type')
        if report_type:
            queryset = queryset.filter(report_type=report_type)

        queryset = queryset.select_related('patient', 'created_by')
        serializer = FinalReportListSerializer(queryset, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="보고서 생성",
        description="새로운 최종 진료 보고서를 생성합니다.",
        request=FinalReportCreateSerializer,
        responses={201: FinalReportDetailSerializer},
    )
    def post(self, request):
        serializer = FinalReportCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        if serializer.is_valid():
            report = serializer.save()
            response_serializer = FinalReportDetailSerializer(report)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=["Reports"])
class FinalReportDetailView(APIView):
    """최종 보고서 상세 조회 / 수정 / 삭제"""

    def get_permissions(self):
        # GET(조회)는 모든 인증된 사용자 허용, PUT/DELETE는 의사/관리자만 허용
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsDoctorOrAdmin()]

    def get_object(self, pk):
        return get_object_or_404(FinalReport, pk=pk, is_deleted=False)

    @extend_schema(
        summary="보고서 상세 조회",
        description="최종 진료 보고서 상세 정보를 조회합니다.",
        responses={200: FinalReportDetailSerializer},
    )
    def get(self, request, pk):
        report = self.get_object(pk)
        serializer = FinalReportDetailSerializer(report)
        return Response(serializer.data)

    @extend_schema(
        summary="보고서 수정",
        description="최종 진료 보고서를 수정합니다. DRAFT 상태에서만 수정 가능합니다.",
        request=FinalReportUpdateSerializer,
        responses={200: FinalReportDetailSerializer},
    )
    def patch(self, request, pk):
        report = self.get_object(pk)
        serializer = FinalReportUpdateSerializer(
            report,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        if serializer.is_valid():
            updated_report = serializer.save()
            response_serializer = FinalReportDetailSerializer(updated_report)
            return Response(response_serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary="보고서 삭제",
        description="최종 진료 보고서를 삭제합니다 (소프트 삭제).",
        responses={204: None},
    )
    def delete(self, request, pk):
        report = self.get_object(pk)

        # DRAFT 상태에서만 삭제 가능
        if report.status != FinalReport.Status.DRAFT:
            return Response(
                {'detail': '작성 중 상태의 보고서만 삭제할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        report.is_deleted = True
        report.save()

        ReportLog.objects.create(
            report=report,
            action=ReportLog.Action.CANCELLED,
            message='보고서가 삭제되었습니다.',
            actor=request.user
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Reports"])
class FinalReportSubmitView(APIView):
    """보고서 검토 제출"""
    permission_classes = [IsDoctorOrAdmin]

    @extend_schema(
        summary="보고서 검토 제출",
        description="보고서를 검토 대기 상태로 제출합니다.",
        responses={200: FinalReportDetailSerializer},
    )
    def post(self, request, pk):
        report = get_object_or_404(FinalReport, pk=pk, is_deleted=False)

        if report.status != FinalReport.Status.DRAFT:
            return Response(
                {'detail': '작성 중 상태의 보고서만 제출할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        report.status = FinalReport.Status.PENDING_REVIEW
        report.save()

        ReportLog.objects.create(
            report=report,
            action=ReportLog.Action.SUBMITTED,
            message='보고서가 검토 제출되었습니다.',
            actor=request.user
        )

        serializer = FinalReportDetailSerializer(report)
        return Response(serializer.data)


@extend_schema(tags=["Reports"])
class FinalReportApproveView(APIView):
    """보고서 승인"""
    permission_classes = [IsDoctorOrAdmin]

    @extend_schema(
        summary="보고서 승인",
        description="보고서를 승인합니다.",
        responses={200: FinalReportDetailSerializer},
    )
    def post(self, request, pk):
        report = get_object_or_404(FinalReport, pk=pk, is_deleted=False)

        if report.status != FinalReport.Status.PENDING_REVIEW:
            return Response(
                {'detail': '검토 대기 상태의 보고서만 승인할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        report.status = FinalReport.Status.APPROVED
        report.reviewed_by = request.user
        report.reviewed_at = timezone.now()
        report.approved_by = request.user
        report.approved_at = timezone.now()
        report.save()

        ReportLog.objects.create(
            report=report,
            action=ReportLog.Action.APPROVED,
            message='보고서가 승인되었습니다.',
            actor=request.user
        )

        serializer = FinalReportDetailSerializer(report)
        return Response(serializer.data)


@extend_schema(tags=["Reports"])
class FinalReportFinalizeView(APIView):
    """보고서 최종 확정"""
    permission_classes = [IsDoctorOrAdmin]

    @extend_schema(
        summary="보고서 최종 확정",
        description="보고서를 최종 확정합니다. 확정 후 수정이 불가능합니다.",
        responses={200: FinalReportDetailSerializer},
    )
    def post(self, request, pk):
        report = get_object_or_404(FinalReport, pk=pk, is_deleted=False)

        if report.status != FinalReport.Status.APPROVED:
            return Response(
                {'detail': '승인된 보고서만 최종 확정할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        report.status = FinalReport.Status.FINALIZED
        report.finalized_at = timezone.now()
        report.save()

        ReportLog.objects.create(
            report=report,
            action=ReportLog.Action.FINALIZED,
            message='보고서가 최종 확정되었습니다.',
            actor=request.user
        )

        serializer = FinalReportDetailSerializer(report)
        return Response(serializer.data)


@extend_schema(tags=["Reports"])
class UnifiedReportDashboardView(APIView):
    """
    통합 보고서 대시보드 API

    모든 보고서를 한 곳에서 조회:
    - OCS 결과 보고서 (RIS/LIS CONFIRMED)
    - AI 추론 결과 (COMPLETED)
    - 최종 진료 보고서 (FinalReport)
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="통합 보고서 대시보드",
        description="OCS 결과, AI 추론 결과, 최종 보고서를 통합하여 조회합니다.",
        parameters=[
            OpenApiParameter(name='patient_id', type=int, description='환자 ID로 필터링'),
            OpenApiParameter(name='report_type', type=str, description='보고서 유형 (OCS_RIS, OCS_LIS, AI_M1, AI_MG, AI_MM, FINAL)'),
            OpenApiParameter(name='date_from', type=str, description='시작 날짜 (YYYY-MM-DD)'),
            OpenApiParameter(name='date_to', type=str, description='종료 날짜 (YYYY-MM-DD)'),
            OpenApiParameter(name='limit', type=int, description='조회 개수 제한 (기본 50)'),
        ],
    )
    def get(self, request):
        patient_id = request.query_params.get('patient_id')
        report_type = request.query_params.get('report_type')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        limit = int(request.query_params.get('limit', 50))

        reports = []

        # 1. OCS 결과 보고서 (CONFIRMED 상태)
        if not report_type or report_type in ['OCS_RIS', 'OCS_LIS']:
            ocs_queryset = OCS.objects.filter(
                ocs_status=OCS.OcsStatus.CONFIRMED
            ).select_related('patient', 'doctor', 'worker')

            if patient_id:
                ocs_queryset = ocs_queryset.filter(patient_id=patient_id)
            if report_type == 'OCS_RIS':
                ocs_queryset = ocs_queryset.filter(job_role='RIS')
            elif report_type == 'OCS_LIS':
                ocs_queryset = ocs_queryset.filter(job_role='LIS')
            if date_from:
                ocs_queryset = ocs_queryset.filter(confirmed_at__date__gte=date_from)
            if date_to:
                ocs_queryset = ocs_queryset.filter(confirmed_at__date__lte=date_to)

            for ocs in ocs_queryset.order_by('-confirmed_at')[:limit]:
                # 썸네일 정보 추출
                thumbnail = self._get_ocs_thumbnail(ocs)

                reports.append({
                    'id': f'ocs_{ocs.id}',
                    'type': f'OCS_{ocs.job_role}',
                    'type_display': '영상검사' if ocs.job_role == 'RIS' else '임상검사',
                    'sub_type': ocs.job_type,
                    'patient_id': ocs.patient.id,
                    'patient_number': ocs.patient.patient_number,
                    'patient_name': ocs.patient.name,
                    'title': f'{ocs.job_type} 검사 결과',
                    'status': 'CONFIRMED',
                    'status_display': '확정',
                    'result': ocs.ocs_result,
                    'result_display': '정상' if ocs.ocs_result else '비정상',
                    'created_at': ocs.created_at.isoformat() if ocs.created_at else None,
                    'completed_at': ocs.confirmed_at.isoformat() if ocs.confirmed_at else None,
                    'author': ocs.worker.name if ocs.worker else None,
                    'doctor': ocs.doctor.name if ocs.doctor else None,
                    'thumbnail': thumbnail,
                    'link': f'/ocs/report/{ocs.id}',
                })

        # 2. AI 추론 결과 (COMPLETED 상태)
        if not report_type or report_type in ['AI_M1', 'AI_MG', 'AI_MM']:
            ai_queryset = AIInference.objects.filter(
                status=AIInference.Status.COMPLETED
            ).select_related('patient', 'mri_ocs', 'rna_ocs', 'protein_ocs', 'requested_by')

            if patient_id:
                ai_queryset = ai_queryset.filter(patient_id=patient_id)
            if report_type == 'AI_M1':
                ai_queryset = ai_queryset.filter(model_type=AIInference.ModelType.M1)
            elif report_type == 'AI_MG':
                ai_queryset = ai_queryset.filter(model_type=AIInference.ModelType.MG)
            elif report_type == 'AI_MM':
                ai_queryset = ai_queryset.filter(model_type=AIInference.ModelType.MM)
            if date_from:
                ai_queryset = ai_queryset.filter(completed_at__date__gte=date_from)
            if date_to:
                ai_queryset = ai_queryset.filter(completed_at__date__lte=date_to)

            for ai in ai_queryset.order_by('-completed_at')[:limit]:
                thumbnail = self._get_ai_thumbnail(ai)

                # 모델 타입에 따른 상세 페이지 경로
                model_type_path = ai.model_type.lower()  # M1 -> m1, MG -> mg, MM -> mm

                reports.append({
                    'id': f'ai_{ai.job_id}',
                    'type': f'AI_{ai.model_type}',
                    'type_display': self._get_ai_type_display(ai.model_type),
                    'sub_type': ai.model_type,
                    'patient_id': ai.patient.id if ai.patient else None,
                    'patient_number': ai.patient.patient_number if ai.patient else None,
                    'patient_name': ai.patient.name if ai.patient else None,
                    'title': f'{self._get_ai_type_display(ai.model_type)} 분석 결과',
                    'status': 'COMPLETED',
                    'status_display': '완료',
                    'result': self._get_ai_result_summary(ai),
                    'result_display': self._get_ai_result_display(ai),
                    'created_at': ai.created_at.isoformat() if ai.created_at else None,
                    'completed_at': ai.completed_at.isoformat() if ai.completed_at else None,
                    'author': ai.requested_by.name if ai.requested_by else None,
                    'doctor': None,
                    'thumbnail': thumbnail,
                    'link': f'/ai/{model_type_path}/{ai.job_id}',
                })

        # 3. 최종 진료 보고서
        if not report_type or report_type == 'FINAL':
            final_queryset = FinalReport.objects.filter(
                is_deleted=False
            ).select_related('patient', 'created_by')

            if patient_id:
                final_queryset = final_queryset.filter(patient_id=patient_id)
            if date_from:
                final_queryset = final_queryset.filter(created_at__date__gte=date_from)
            if date_to:
                final_queryset = final_queryset.filter(created_at__date__lte=date_to)

            for report in final_queryset.order_by('-created_at')[:limit]:
                reports.append({
                    'id': f'final_{report.id}',
                    'type': 'FINAL',
                    'type_display': '최종 보고서',
                    'sub_type': report.report_type,
                    'patient_id': report.patient.id if report.patient else None,
                    'patient_number': report.patient.patient_number if report.patient else None,
                    'patient_name': report.patient.name if report.patient else None,
                    'title': f'{report.get_report_type_display()} - {(report.primary_diagnosis or "")[:30]}...' if report.primary_diagnosis and len(report.primary_diagnosis) > 30 else f'{report.get_report_type_display()} - {report.primary_diagnosis or ""}',
                    'status': report.status,
                    'status_display': report.get_status_display(),
                    'result': None,
                    'result_display': report.get_status_display(),
                    'created_at': report.created_at.isoformat() if report.created_at else None,
                    'completed_at': report.finalized_at.isoformat() if report.finalized_at else None,
                    'author': report.created_by.name if report.created_by else None,
                    'doctor': report.created_by.name if report.created_by else None,
                    'thumbnail': {'type': 'icon', 'icon': 'document'},
                    'link': f'/reports/{report.id}',
                })

        # 날짜순 정렬 (최신순)
        reports.sort(key=lambda x: x['completed_at'] or x['created_at'] or '', reverse=True)

        return Response({
            'count': len(reports),
            'reports': reports[:limit]
        })

    def _get_ocs_thumbnail(self, ocs):
        """OCS 썸네일 정보 생성"""
        if ocs.job_role == 'RIS':
            # Orthanc Study ID가 있으면 실제 DICOM 썸네일 사용
            worker_result = ocs.worker_result or {}
            orthanc_info = worker_result.get('orthanc') or {}
            orthanc_study_id = orthanc_info.get('orthanc_study_id')

            if orthanc_study_id:
                # 시리즈 정보가 있으면 각 채널별 썸네일 URL 생성
                series_list = orthanc_info.get('series', [])
                if series_list:
                    # 각 채널 (T1, T1C, T2, FLAIR)에 대한 썸네일 생성
                    channel_thumbnails = []
                    channel_order = {'T1': 0, 'T1C': 1, 'T2': 2, 'FLAIR': 3}

                    for series in series_list:
                        series_type = series.get('series_type', 'OTHER')
                        orthanc_id = series.get('orthanc_id')

                        # MRI 4채널만 포함 (SEG 제외)
                        if series_type in channel_order and orthanc_id:
                            channel_thumbnails.append({
                                'channel': series_type,
                                'url': f'/api/orthanc/series/{orthanc_id}/thumbnail/',
                                'description': series.get('description', series_type),
                            })

                    # 채널 순서로 정렬
                    channel_thumbnails.sort(key=lambda x: channel_order.get(x['channel'], 99))

                    if channel_thumbnails:
                        return {
                            'type': 'dicom_multi',
                            'orthanc_study_id': orthanc_study_id,
                            'thumbnails_url': f'/api/orthanc/studies/{orthanc_study_id}/thumbnails/',
                            'channels': channel_thumbnails,
                        }

                # 시리즈 정보가 없으면 study 썸네일 API 사용
                return {
                    'type': 'dicom',
                    'orthanc_study_id': orthanc_study_id,
                    'thumbnails_url': f'/api/orthanc/studies/{orthanc_study_id}/thumbnails/',
                }

            # DICOM 정보 없으면 아이콘 폴백
            return {
                'type': 'icon',
                'icon': 'mri',
                'color': '#3b82f6',  # blue
            }
        elif ocs.job_role == 'LIS':
            job_type = ocs.job_type or ''
            if 'GENE' in job_type.upper() or 'RNA' in job_type.upper():
                return {
                    'type': 'icon',
                    'icon': 'dna',
                    'color': '#10b981',  # green
                }
            elif 'BIOMARKER' in job_type.upper() or 'PROTEIN' in job_type.upper():
                return {
                    'type': 'icon',
                    'icon': 'protein',
                    'color': '#8b5cf6',  # purple
                }
            return {
                'type': 'icon',
                'icon': 'lab',
                'color': '#f59e0b',  # amber
            }
        return {'type': 'icon', 'icon': 'document'}

    def _get_ai_thumbnail(self, ai):
        """AI 추론 썸네일 정보 생성"""
        result_data = ai.result_data or {}
        saved_files = result_data.get('saved_files', {})

        if ai.model_type == AIInference.ModelType.M1:
            # M1: MRI 채널 + 세그멘테이션 오버레이 썸네일
            thumbnail_data = {
                'type': 'segmentation_overlay',
                'job_id': ai.job_id,
                'overlay_url': f'/api/ai/inferences/{ai.job_id}/thumbnail/',
                'icon': 'brain',
                'color': '#ef4444',
            }

            # mri_ocs가 있으면 원본 MRI 채널 정보도 포함
            if ai.mri_ocs:
                mri_thumb = self._get_ocs_thumbnail(ai.mri_ocs)
                if mri_thumb.get('type') == 'dicom_multi':
                    thumbnail_data['channels'] = mri_thumb.get('channels', [])
                    thumbnail_data['type'] = 'segmentation_with_mri'

            return thumbnail_data
        elif ai.model_type == AIInference.ModelType.MG:
            # MG: 유전자 발현 차트
            return {
                'type': 'chart',
                'chart_type': 'gene_expression',
                'job_id': ai.job_id,
                'icon': 'dna',
                'color': '#10b981',  # green
            }
        elif ai.model_type == AIInference.ModelType.MM:
            # MM: 멀티모달 분석
            return {
                'type': 'icon',
                'icon': 'multimodal',
                'color': '#6366f1',  # indigo
            }
        return {'type': 'icon', 'icon': 'ai'}

    def _get_ai_type_display(self, model_type):
        """AI 모델 타입 한글 표시"""
        displays = {
            'M1': 'MRI 종양 분석',
            'MG': '유전자 발현 분석',
            'MM': '멀티모달 분석',
        }
        return displays.get(model_type, 'AI 분석')

    def _get_ai_result_summary(self, ai):
        """AI 결과 요약"""
        result_data = ai.result_data or {}
        if ai.model_type == AIInference.ModelType.M1:
            return {
                'tumor_detected': result_data.get('tumor_detected', False),
                'classification': result_data.get('classification'),
                'volumes': result_data.get('volumes', {}),
            }
        elif ai.model_type == AIInference.ModelType.MG:
            return {
                'prediction': result_data.get('prediction'),
                'confidence': result_data.get('confidence'),
            }
        elif ai.model_type == AIInference.ModelType.MM:
            return {
                'final_prediction': result_data.get('final_prediction'),
                'survival_prediction': result_data.get('survival_prediction'),
            }
        return result_data

    def _get_ai_result_display(self, ai):
        """AI 결과 표시 문자열"""
        result_data = ai.result_data or {}
        if ai.model_type == AIInference.ModelType.M1:
            if result_data.get('tumor_detected'):
                return f"종양 발견 - {result_data.get('classification', '분류 중')}"
            return "종양 미발견"
        elif ai.model_type == AIInference.ModelType.MG:
            pred = result_data.get('prediction', '분석 중')
            conf = result_data.get('confidence')
            if conf:
                return f"{pred} ({conf:.1%})"
            return pred
        elif ai.model_type == AIInference.ModelType.MM:
            return result_data.get('final_prediction', '분석 완료')
        return '완료'


@extend_schema(tags=["Reports"])
class PatientReportTimelineView(APIView):
    """
    환자별 보고서 타임라인 API

    특정 환자의 모든 보고서를 시간순으로 조회
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="환자별 보고서 타임라인",
        description="특정 환자의 모든 보고서를 시간순으로 조회합니다.",
    )
    def get(self, request, patient_id):
        from apps.patients.models import Patient

        try:
            patient = Patient.objects.get(id=patient_id)
        except Patient.DoesNotExist:
            return Response(
                {'detail': '환자를 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )

        timeline = []

        # 1. OCS 결과
        ocs_list = OCS.objects.filter(
            patient=patient,
            ocs_status=OCS.OcsStatus.CONFIRMED
        ).select_related('doctor', 'worker').order_by('-confirmed_at')

        for ocs in ocs_list:
            timeline.append({
                'id': f'ocs_{ocs.id}',
                'type': f'OCS_{ocs.job_role}',
                'type_display': '영상검사' if ocs.job_role == 'RIS' else '임상검사',
                'sub_type': ocs.job_type,
                'title': f'{ocs.job_type} 검사 결과',
                'date': ocs.confirmed_at.isoformat() if ocs.confirmed_at else ocs.created_at.isoformat(),
                'status': 'CONFIRMED',
                'result': '정상' if ocs.ocs_result else '비정상',
                'result_flag': 'normal' if ocs.ocs_result else 'abnormal',
                'author': ocs.worker.name if ocs.worker else None,
                'link': f'/ocs/report/{ocs.id}',
            })

        # 2. AI 추론 결과
        ai_list = AIInference.objects.filter(
            patient=patient,
            status=AIInference.Status.COMPLETED
        ).order_by('-completed_at')

        for ai in ai_list:
            result_data = ai.result_data or {}
            model_type_path = ai.model_type.lower()  # M1 -> m1, MG -> mg, MM -> mm
            timeline.append({
                'id': f'ai_{ai.job_id}',
                'type': f'AI_{ai.model_type}',
                'type_display': self._get_ai_type_display(ai.model_type),
                'sub_type': ai.model_type,
                'title': f'{self._get_ai_type_display(ai.model_type)} 결과',
                'date': ai.completed_at.isoformat() if ai.completed_at else ai.created_at.isoformat(),
                'status': 'COMPLETED',
                'result': self._get_ai_result_display(ai),
                'result_flag': 'ai',
                'author': ai.requested_by.name if ai.requested_by else None,
                'link': f'/ai/{model_type_path}/{ai.job_id}',
            })

        # 3. 최종 보고서
        final_list = FinalReport.objects.filter(
            patient=patient,
            is_deleted=False
        ).select_related('created_by').order_by('-created_at')

        for report in final_list:
            timeline.append({
                'id': f'final_{report.id}',
                'type': 'FINAL',
                'type_display': '최종 보고서',
                'sub_type': report.report_type,
                'title': f'{report.get_report_type_display()} - {report.primary_diagnosis[:20]}...' if len(report.primary_diagnosis) > 20 else f'{report.get_report_type_display()} - {report.primary_diagnosis}',
                'date': report.finalized_at.isoformat() if report.finalized_at else report.created_at.isoformat(),
                'status': report.status,
                'result': report.get_status_display(),
                'result_flag': 'final',
                'author': report.created_by.name if report.created_by else None,
                'link': f'/reports/{report.id}',
            })

        # 날짜순 정렬 (최신순)
        timeline.sort(key=lambda x: x['date'], reverse=True)

        return Response({
            'patient_id': patient.id,
            'patient_number': patient.patient_number,
            'patient_name': patient.name,
            'count': len(timeline),
            'timeline': timeline
        })

    def _get_ai_type_display(self, model_type):
        displays = {
            'M1': 'MRI 종양 분석',
            'MG': '유전자 발현 분석',
            'MM': '멀티모달 분석',
        }
        return displays.get(model_type, 'AI 분석')

    def _get_ai_result_display(self, ai):
        result_data = ai.result_data or {}
        if ai.model_type == AIInference.ModelType.M1:
            if result_data.get('tumor_detected'):
                return f"종양 발견"
            return "종양 미발견"
        elif ai.model_type == AIInference.ModelType.MG:
            return result_data.get('prediction', '분석 완료')
        elif ai.model_type == AIInference.ModelType.MM:
            return result_data.get('final_prediction', '분석 완료')
        return '완료'
