from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone

from .models import Patient, PatientAlert
from .serializers import (
    PatientListSerializer,
    PatientDetailSerializer,
    PatientCreateSerializer,
    PatientUpdateSerializer,
    PatientSearchSerializer,
    PatientAlertListSerializer,
    PatientAlertDetailSerializer,
    PatientAlertCreateSerializer,
    PatientAlertUpdateSerializer,
    PatientDashboardSerializer,
    PatientEncounterListSerializer,
    PatientOCSListSerializer,
)
from .services import PatientService


class PatientPagination(PageNumberPagination):
    """환자 목록 페이지네이션"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def patient_list_create(request):
    """
    환자 목록 조회 및 등록

    GET: 환자 목록 조회
    POST: 환자 등록
    """
    if request.method == 'GET':
        # 검색 필터 처리
        search_serializer = PatientSearchSerializer(data=request.query_params)
        if not search_serializer.is_valid():
            return Response(
                search_serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        filters = search_serializer.validated_data
        patients = PatientService.get_all_patients(filters)

        # 페이지네이션
        paginator = PatientPagination()
        page = paginator.paginate_queryset(patients, request)

        if page is not None:
            serializer = PatientListSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = PatientListSerializer(patients, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = PatientCreateSerializer(
            data=request.data,
            context={'request': request}
        )

        if serializer.is_valid():
            try:
                patient = PatientService.create_patient(
                    serializer.validated_data,
                    request.user
                )
                return Response(
                    PatientDetailSerializer(patient).data,
                    status=status.HTTP_201_CREATED
                )
            except Exception as e:
                return Response(
                    {'detail': str(e)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def patient_detail(request, patient_id):
    """
    환자 상세 조회, 수정, 삭제

    GET: 환자 상세 조회
    PUT: 환자 정보 수정
    DELETE: 환자 삭제 (Soft Delete)
    """
    try:
        if request.method == 'GET':
            patient = PatientService.get_patient_by_id(patient_id)
            # TODO: Add audit log
            serializer = PatientDetailSerializer(patient)
            return Response(serializer.data)

        elif request.method == 'PUT':
            serializer = PatientUpdateSerializer(data=request.data)

            if serializer.is_valid():
                patient = PatientService.update_patient(
                    patient_id,
                    serializer.validated_data,
                    request.user
                )
                return Response(PatientDetailSerializer(patient).data)

            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        elif request.method == 'DELETE':
            patient = PatientService.delete_patient(patient_id, request.user)
            return Response(
                {'message': '환자가 삭제되었습니다.'},
                status=status.HTTP_204_NO_CONTENT
            )

    except ObjectDoesNotExist:
        return Response(
            {'detail': '환자를 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'detail': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_search(request):
    """
    환자 통합 검색 (자동완성용)

    Query Parameters:
        q: 검색어
    """
    query = request.query_params.get('q', '').strip()

    if not query:
        return Response([])

    if len(query) < 2:
        return Response(
            {'detail': '검색어는 2자 이상 입력해주세요.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    patients = PatientService.search_patients(query)
    serializer = PatientListSerializer(patients, many=True)

    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_statistics(request):
    """
    환자 통계 조회

    Returns:
        환자 총계, 활성/비활성 수, 성별 통계 등
    """
    stats = PatientService.get_patient_statistics()
    return Response(stats)


def _generate_external_patient_number():
    """외부 환자용 환자번호 생성 (EXTR_0001 형식)"""
    last_external = Patient.objects.filter(
        patient_number__startswith='EXTR_'
    ).order_by('-patient_number').first()

    if last_external and last_external.patient_number:
        try:
            last_num = int(last_external.patient_number.split('_')[1])
            return f"EXTR_{last_num + 1:04d}"
        except (ValueError, IndexError):
            pass
    return "EXTR_0001"


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_external_patient(request):
    """
    외부 기관 환자 등록

    외부 검사 결과를 업로드할 때 환자가 시스템에 등록되지 않은 경우
    간소화된 정보로 환자를 등록합니다.

    Required fields:
        - name: 환자명
        - birth_date: 생년월일 (YYYY-MM-DD)
        - gender: 성별 (M/F/O)

    Optional fields:
        - phone: 전화번호
        - institution_name: 외부 기관명
        - external_patient_id: 외부 기관의 환자 ID
    """
    # 필수 필드 검증
    name = request.data.get('name')
    birth_date = request.data.get('birth_date')
    gender = request.data.get('gender')

    if not all([name, birth_date, gender]):
        return Response(
            {'detail': '필수 정보가 누락되었습니다. (이름, 생년월일, 성별)'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 성별 검증
    if gender not in ['M', 'F', 'O']:
        return Response(
            {'detail': '성별은 M, F, O 중 하나여야 합니다.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 생년월일 형식 검증
    from datetime import datetime
    try:
        birth_date_parsed = datetime.strptime(birth_date, '%Y-%m-%d').date()
    except ValueError:
        return Response(
            {'detail': '생년월일 형식이 올바르지 않습니다. (YYYY-MM-DD)'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 외부 환자번호 생성
    patient_number = _generate_external_patient_number()

    # 외부 기관 정보 (메타데이터로 저장)
    external_info = {}
    if request.data.get('institution_name'):
        external_info['institution_name'] = request.data.get('institution_name')
    if request.data.get('external_patient_id'):
        external_info['external_patient_id'] = request.data.get('external_patient_id')

    # SSN 생성 (외부 환자는 가상의 SSN 사용)
    # 형식: EXTR_{환자번호}_{타임스탬프}
    import time
    virtual_ssn = f"EXTR_{patient_number}_{int(time.time())}"

    try:
        patient = Patient.objects.create(
            patient_number=patient_number,
            name=name,
            birth_date=birth_date_parsed,
            gender=gender,
            phone=request.data.get('phone', '000-0000-0000'),  # 기본값
            ssn=virtual_ssn,
            address=request.data.get('address', ''),
            status='active',
            registered_by=request.user,
            # 외부 환자 관련 메타 정보는 chronic_diseases JSON 필드 활용
            chronic_diseases=external_info if external_info else [],
        )

        return Response({
            'message': '외부 환자가 등록되었습니다.',
            'patient': PatientDetailSerializer(patient).data
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response(
            {'detail': f'환자 등록 중 오류가 발생했습니다: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_summary(request, patient_id):
    """
    환자 요약서 데이터 조회 (PDF 생성용)

    Returns:
        - patient: 기본정보 (이름, 나이, 성별, 연락처, 주소)
        - encounters: 최근 진료이력 (최근 10건)
        - ocs_history: OCS (RIS/LIS) 검사이력 (최근 10건)
        - ai_inferences: AI 추론이력 (최근 5건)
        - treatment_plans: 치료계획 (최근 5건)
        - prescriptions: 처방이력 (최근 10건)
        - generated_at: 생성 시각
    """
    try:
        patient = PatientService.get_patient_by_id(patient_id)
    except ObjectDoesNotExist:
        return Response(
            {'detail': '환자를 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )

    # 기본 정보
    patient_data = PatientDetailSerializer(patient).data

    # 진료 이력 (최근 10건)
    from apps.encounters.models import Encounter
    from apps.encounters.serializers import EncounterListSerializer
    encounters = Encounter.objects.filter(
        patient=patient, is_deleted=False
    ).order_by('-admission_date')[:10]
    encounter_data = EncounterListSerializer(encounters, many=True).data

    # OCS 이력 (최근 10건)
    from apps.ocs.models import OCS
    from apps.ocs.serializers import OCSListSerializer
    ocs_list = OCS.objects.filter(
        patient=patient, is_deleted=False
    ).order_by('-created_at')[:10]
    ocs_data = OCSListSerializer(ocs_list, many=True).data

    # AI 추론 이력 (최근 5건)
    from apps.ai_inference.models import AIInference
    from apps.ai_inference.serializers import AIInferenceSerializer
    ai_requests = AIInference.objects.filter(
        patient=patient
    ).order_by('-created_at')[:5]
    ai_data = AIInferenceSerializer(ai_requests, many=True).data

    # 치료 계획 (최근 5건)
    try:
        from apps.treatment.models import TreatmentPlan
        from apps.treatment.serializers import TreatmentPlanListSerializer
        treatment_plans = TreatmentPlan.objects.filter(
            patient=patient, is_deleted=False
        ).order_by('-created_at')[:5]
        treatment_data = TreatmentPlanListSerializer(treatment_plans, many=True).data
    except Exception:
        treatment_data = []

    # 처방 이력 (최근 10건)
    try:
        from apps.prescriptions.models import Prescription
        from apps.prescriptions.serializers import PrescriptionListSerializer
        prescriptions = Prescription.objects.filter(
            patient=patient
        ).order_by('-prescribed_at')[:10]
        prescription_data = PrescriptionListSerializer(prescriptions, many=True).data
    except Exception:
        prescription_data = []

    return Response({
        'patient': patient_data,
        'encounters': encounter_data,
        'ocs_history': ocs_data,
        'ai_inferences': ai_data,
        'treatment_plans': treatment_data,
        'prescriptions': prescription_data,
        'generated_at': timezone.now().isoformat()
    })


# ========== PatientAlert Views ==========

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def patient_alerts_list_create(request, patient_id):
    """
    환자 주의사항 목록 조회 및 등록

    GET: 특정 환자의 주의사항 목록 조회
    POST: 주의사항 등록
    """
    try:
        patient = PatientService.get_patient_by_id(patient_id)
    except ObjectDoesNotExist:
        return Response(
            {'detail': '환자를 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        # 활성 주의사항만 조회 (옵션)
        include_inactive = request.query_params.get('include_inactive', 'false').lower() == 'true'

        alerts = PatientAlert.objects.filter(patient=patient)
        if not include_inactive:
            alerts = alerts.filter(is_active=True)

        alerts = alerts.order_by('-severity', '-created_at')
        serializer = PatientAlertListSerializer(alerts, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        data = request.data.copy()
        data['patient'] = patient_id

        serializer = PatientAlertCreateSerializer(
            data=data,
            context={'request': request}
        )

        if serializer.is_valid():
            alert = serializer.save()
            return Response(
                PatientAlertDetailSerializer(alert).data,
                status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def patient_alert_detail(request, patient_id, alert_id):
    """
    환자 주의사항 상세 조회, 수정, 삭제

    GET: 주의사항 상세 조회
    PUT: 주의사항 수정
    DELETE: 주의사항 삭제
    """
    try:
        patient = PatientService.get_patient_by_id(patient_id)
        alert = PatientAlert.objects.get(id=alert_id, patient=patient)
    except ObjectDoesNotExist:
        return Response(
            {'detail': '주의사항을 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        serializer = PatientAlertDetailSerializer(alert)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = PatientAlertUpdateSerializer(
            alert,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response(PatientAlertDetailSerializer(alert).data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        alert.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_examination_summary(request, patient_id):
    """
    환자 진찰 요약 데이터 조회 (ExaminationTab용)

    Returns:
        - patient: 기본정보 (이름, 나이, 성별, 혈액형, 알레르기, 기저질환)
        - alerts: 환자 주의사항 목록 (활성만)
        - current_encounter: 현재 진료 정보 (SOAP 포함)
        - recent_encounters: 최근 진료이력 (최근 5건)
        - recent_ocs: 최근 OCS 검사 (RIS/LIS 최근 5건씩)
        - vital_signs: 최근 활력징후 (있는 경우)
    """
    try:
        patient = PatientService.get_patient_by_id(patient_id)
    except ObjectDoesNotExist:
        return Response(
            {'detail': '환자를 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response(
            {'detail': f'환자 조회 중 오류: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # 환자 기본 정보 (age는 birth_date가 없을 수 있으므로 안전하게 처리)
    try:
        patient_age = patient.age if patient.birth_date else None
    except Exception:
        patient_age = None

    patient_data = {
        'id': patient.id,
        'patient_number': patient.patient_number,
        'name': patient.name,
        'age': patient_age,
        'gender': patient.gender,
        'blood_type': patient.blood_type,
        'allergies': patient.allergies or [],
        'chronic_diseases': patient.chronic_diseases or [],
        'chief_complaint': getattr(patient, 'chief_complaint', '') or '',
    }

    # 환자 주의사항 (활성만)
    try:
        alerts = PatientAlert.objects.filter(
            patient=patient, is_active=True
        ).order_by('-severity', '-created_at')
        alerts_data = PatientAlertListSerializer(alerts, many=True).data
    except Exception as e:
        import traceback
        traceback.print_exc()
        alerts_data = []

    # 현재 진료 (진행중인 가장 최근 진료)
    try:
        from apps.encounters.models import Encounter
        from apps.encounters.serializers import EncounterDetailSerializer, EncounterListSerializer

        current_encounter = Encounter.objects.filter(
            patient=patient,
            status__in=['scheduled', 'in_progress'],
            is_deleted=False
        ).order_by('-admission_date').first()

        current_encounter_data = None
        if current_encounter:
            current_encounter_data = EncounterDetailSerializer(current_encounter).data

        # 최근 진료이력 (최근 5건, 현재 진료 제외)
        recent_encounters = Encounter.objects.filter(
            patient=patient,
            is_deleted=False
        ).order_by('-admission_date')

        if current_encounter:
            recent_encounters = recent_encounters.exclude(id=current_encounter.id)

        recent_encounters = recent_encounters[:5]
        recent_encounters_data = EncounterListSerializer(recent_encounters, many=True).data
    except Exception as e:
        import traceback
        traceback.print_exc()
        current_encounter_data = None
        recent_encounters_data = []

    # 최근 OCS (RIS/LIS 각각 5건)
    try:
        from apps.ocs.models import OCS
        from apps.ocs.serializers import OCSListSerializer

        recent_ris = OCS.objects.filter(
            patient=patient,
            job_role='RIS',
            is_deleted=False
        ).order_by('-created_at')[:5]

        recent_lis = OCS.objects.filter(
            patient=patient,
            job_role='LIS',
            is_deleted=False
        ).order_by('-created_at')[:5]

        ocs_data = {
            'ris': OCSListSerializer(recent_ris, many=True).data,
            'lis': OCSListSerializer(recent_lis, many=True).data,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        ocs_data = {'ris': [], 'lis': []}

    # 최근 AI 추론 결과 (1건)
    ai_summary = None
    try:
        from apps.ai_inference.models import AIInferenceRequest
        latest_ai = AIInferenceRequest.objects.filter(
            patient=patient,
            status='COMPLETED'
        ).order_by('-created_at').first()

        if latest_ai and latest_ai.result:
            ai_summary = {
                'id': latest_ai.id,
                'created_at': latest_ai.created_at,
                'result': latest_ai.result,
            }
    except Exception:
        pass

    return Response({
        'patient': patient_data,
        'alerts': alerts_data,
        'current_encounter': current_encounter_data,
        'recent_encounters': recent_encounters_data,
        'recent_ocs': ocs_data,
        'ai_summary': ai_summary,
        'generated_at': timezone.now().isoformat()
    })


# ========== Patient Dashboard Views (환자용 마이페이지) ==========

def _get_patient_from_user(user):
    """
    로그인한 사용자로부터 연결된 Patient 객체를 조회
    PATIENT 역할 사용자만 가능
    """
    # 역할 확인
    if not user.role or user.role.code != 'PATIENT':
        return None, Response(
            {'detail': '환자 계정으로만 접근할 수 있습니다.'},
            status=status.HTTP_403_FORBIDDEN
        )

    # User-Patient 연결 확인 (OneToOneField: related_name='patient_profile')
    try:
        patient = user.patient_profile
        if patient.is_deleted:
            return None, Response(
                {'detail': '삭제된 환자 정보입니다.'},
                status=status.HTTP_404_NOT_FOUND
            )
        return patient, None
    except Patient.DoesNotExist:
        return None, Response(
            {'detail': '연결된 환자 정보가 없습니다. 관리자에게 문의하세요.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_me(request):
    """
    환자 본인 정보 조회 (GET /api/patients/me/)

    PATIENT 역할의 사용자가 자신의 환자 정보를 조회합니다.

    Returns:
        - patient: 환자 기본정보
        - attending_doctor_name: 주치의 이름
        - attending_doctor_department: 주치의 진료과
    """
    patient, error_response = _get_patient_from_user(request.user)
    if error_response:
        return error_response

    serializer = PatientDashboardSerializer(patient)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_me_encounters(request):
    """
    환자 본인 진료 이력 조회 (GET /api/patients/me/encounters/)

    PATIENT 역할의 사용자가 자신의 진료 이력을 조회합니다.

    Query Parameters:
        - page: 페이지 번호 (기본: 1)
        - page_size: 페이지 크기 (기본: 10, 최대: 50)
        - status: 진료 상태 필터 (scheduled, in_progress, completed, cancelled)

    Returns:
        - count: 전체 건수
        - results: 진료 이력 목록
    """
    patient, error_response = _get_patient_from_user(request.user)
    if error_response:
        return error_response

    from apps.encounters.models import Encounter

    # 기본 쿼리셋
    queryset = Encounter.objects.filter(
        patient=patient,
        is_deleted=False
    ).select_related('attending_doctor').order_by('-admission_date')

    # 상태 필터
    status_filter = request.query_params.get('status')
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    # 페이지네이션
    paginator = PatientPagination()
    paginator.page_size = 10
    paginator.max_page_size = 50
    page = paginator.paginate_queryset(queryset, request)

    if page is not None:
        serializer = PatientEncounterListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    serializer = PatientEncounterListSerializer(queryset, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_me_ocs(request):
    """
    환자 본인 OCS(검사) 이력 조회 (GET /api/patients/me/ocs/)

    PATIENT 역할의 사용자가 자신의 검사 이력을 조회합니다.
    CONFIRMED(확정) 상태의 검사만 조회됩니다.

    Query Parameters:
        - page: 페이지 번호 (기본: 1)
        - page_size: 페이지 크기 (기본: 10, 최대: 50)
        - job_role: 검사 종류 필터 (RIS, LIS)

    Returns:
        - count: 전체 건수
        - results: OCS 이력 목록
    """
    patient, error_response = _get_patient_from_user(request.user)
    if error_response:
        return error_response

    from apps.ocs.models import OCS

    # 기본 쿼리셋: CONFIRMED 상태만 조회 (환자는 확정된 결과만 볼 수 있음)
    queryset = OCS.objects.filter(
        patient=patient,
        ocs_status=OCS.OcsStatus.CONFIRMED,
        is_deleted=False
    ).select_related('doctor').order_by('-confirmed_at')

    # job_role 필터
    job_role = request.query_params.get('job_role')
    if job_role:
        queryset = queryset.filter(job_role=job_role.upper())

    # 페이지네이션
    paginator = PatientPagination()
    paginator.page_size = 10
    paginator.max_page_size = 50
    page = paginator.paginate_queryset(queryset, request)

    if page is not None:
        serializer = PatientOCSListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    serializer = PatientOCSListSerializer(queryset, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_me_alerts(request):
    """
    환자 본인 주의사항 조회 (GET /api/patients/me/alerts/)

    PATIENT 역할의 사용자가 자신의 주의사항(알레르기, 금기사항 등)을 조회합니다.
    활성(is_active=True) 상태의 주의사항만 조회됩니다.

    Returns:
        - alerts: 주의사항 목록
    """
    patient, error_response = _get_patient_from_user(request.user)
    if error_response:
        return error_response

    # 활성 주의사항만 조회
    alerts = PatientAlert.objects.filter(
        patient=patient,
        is_active=True
    ).order_by('-severity', '-created_at')

    serializer = PatientAlertListSerializer(alerts, many=True)
    return Response(serializer.data)
