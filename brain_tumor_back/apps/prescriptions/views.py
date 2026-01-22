import csv
import io
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.utils import timezone
from django.db.models import Max, Q

from .models import Prescription, PrescriptionItem, Medication
from .serializers import (
    PrescriptionListSerializer,
    PrescriptionDetailSerializer,
    PrescriptionCreateSerializer,
    PrescriptionUpdateSerializer,
    PrescriptionIssueSerializer,
    PrescriptionCancelSerializer,
    PrescriptionItemSerializer,
    PrescriptionItemCreateSerializer,
    MedicationListSerializer,
    MedicationDetailSerializer,
    MedicationCreateSerializer,
    MedicationUpdateSerializer,
    QuickPrescribeSerializer,
)


class MedicationViewSet(viewsets.ModelViewSet):
    """
    의약품 마스터 ViewSet

    - GET /api/medications/ : 의약품 목록 (검색/필터 지원)
    - POST /api/medications/ : 의약품 등록
    - GET /api/medications/{id}/ : 의약품 상세
    - PATCH /api/medications/{id}/ : 의약품 수정
    - DELETE /api/medications/{id}/ : 의약품 삭제
    - POST /api/medications/upload-csv/ : CSV 일괄 업로드
    - GET /api/medications/categories/ : 카테고리 목록
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Medication.objects.all()

        # 검색어 (코드, 이름, 일반명)
        q = self.request.query_params.get('q')
        if q:
            queryset = queryset.filter(
                Q(code__icontains=q) |
                Q(name__icontains=q) |
                Q(generic_name__icontains=q)
            )

        # 카테고리 필터
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        # 활성 상태 필터 (기본값: True)
        is_active = self.request.query_params.get('is_active', 'true')
        if is_active.lower() == 'true':
            queryset = queryset.filter(is_active=True)
        elif is_active.lower() == 'false':
            queryset = queryset.filter(is_active=False)

        return queryset.order_by('category', 'name')

    def get_serializer_class(self):
        if self.action == 'list':
            return MedicationListSerializer
        if self.action == 'create':
            return MedicationCreateSerializer
        if self.action in ['update', 'partial_update']:
            return MedicationUpdateSerializer
        return MedicationDetailSerializer

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """의약품 카테고리 목록"""
        categories = [
            {'value': choice[0], 'label': choice[1]}
            for choice in Medication.Category.choices
        ]
        return Response(categories)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_csv(self, request):
        """
        CSV 파일로 의약품 일괄 등록

        CSV 형식:
        code,name,generic_name,category,default_dosage,default_route,default_frequency,default_duration_days,unit,warnings,contraindications
        """
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'detail': 'CSV 파일이 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            decoded_file = file.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(decoded_file))

            created_count = 0
            updated_count = 0
            errors = []

            for row_num, row in enumerate(reader, start=2):
                try:
                    code = row.get('code', '').strip()
                    if not code:
                        errors.append(f"행 {row_num}: 의약품 코드가 없습니다.")
                        continue

                    defaults = {
                        'name': row.get('name', '').strip(),
                        'generic_name': row.get('generic_name', '').strip() or None,
                        'category': row.get('category', 'OTHER').strip(),
                        'default_dosage': row.get('default_dosage', '').strip(),
                        'default_route': row.get('default_route', 'PO').strip(),
                        'default_frequency': row.get('default_frequency', 'TID').strip(),
                        'default_duration_days': int(row.get('default_duration_days', 7) or 7),
                        'unit': row.get('unit', '정').strip(),
                        'warnings': row.get('warnings', '').strip() or None,
                        'contraindications': row.get('contraindications', '').strip() or None,
                        'is_active': True,
                    }

                    medication, created = Medication.objects.update_or_create(
                        code=code,
                        defaults=defaults
                    )

                    if created:
                        created_count += 1
                    else:
                        updated_count += 1

                except Exception as e:
                    errors.append(f"행 {row_num}: {str(e)}")

            return Response({
                'message': f'업로드 완료: {created_count}개 생성, {updated_count}개 업데이트',
                'created_count': created_count,
                'updated_count': updated_count,
                'errors': errors if errors else None
            })

        except UnicodeDecodeError:
            return Response(
                {'detail': 'UTF-8 인코딩 파일만 지원합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'detail': f'파일 처리 중 오류: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def template(self, request):
        """CSV 템플릿 다운로드용 헤더 반환"""
        return Response({
            'columns': [
                'code', 'name', 'generic_name', 'category', 'default_dosage',
                'default_route', 'default_frequency', 'default_duration_days',
                'unit', 'warnings', 'contraindications'
            ],
            'category_choices': [c[0] for c in Medication.Category.choices],
            'route_choices': [c[0] for c in Medication.Route.choices],
            'frequency_choices': ['QD', 'BID', 'TID', 'QID', 'PRN', 'QOD', 'QW'],
        })


class PrescriptionViewSet(viewsets.ModelViewSet):
    """
    처방전 ViewSet
    
    - GET /api/prescriptions/ : 처방전 목록
    - POST /api/prescriptions/ : 처방전 생성
    - GET /api/prescriptions/{id}/ : 처방전 상세
    - PATCH /api/prescriptions/{id}/ : 처방전 수정
    - POST /api/prescriptions/{id}/issue/ : 처방전 발행
    - POST /api/prescriptions/{id}/cancel/ : 처방전 취소
    - POST /api/prescriptions/{id}/items/ : 항목 추가
    - DELETE /api/prescriptions/{id}/items/{item_id}/ : 항목 삭제
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Prescription.objects.select_related(
            'patient', 'doctor', 'encounter'
        ).prefetch_related('items')

        # 필터링
        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)

        doctor_id = self.request.query_params.get('doctor_id')
        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)

        encounter_id = self.request.query_params.get('encounter_id')
        if encounter_id:
            queryset = queryset.filter(encounter_id=encounter_id)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # 내 처방만 보기
        my_only = self.request.query_params.get('my_only')
        if my_only == 'true':
            queryset = queryset.filter(doctor=self.request.user)

        # 날짜 범위 필터
        start_date = self.request.query_params.get('start_date')
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)

        end_date = self.request.query_params.get('end_date')
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        return queryset.order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'list':
            return PrescriptionListSerializer
        if self.action == 'create':
            return PrescriptionCreateSerializer
        if self.action in ['update', 'partial_update']:
            return PrescriptionUpdateSerializer
        if self.action == 'issue':
            return PrescriptionIssueSerializer
        if self.action == 'cancel':
            return PrescriptionCancelSerializer
        return PrescriptionDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prescription = serializer.save()
        
        # 상세 정보 반환
        detail_serializer = PrescriptionDetailSerializer(prescription)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def issue(self, request, pk=None):
        """처방전 발행"""
        prescription = self.get_object()

        if prescription.status != Prescription.Status.DRAFT:
            return Response(
                {'detail': '작성 중인 처방전만 발행할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if prescription.items.count() == 0:
            return Response(
                {'detail': '처방 항목이 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        prescription.status = Prescription.Status.ISSUED
        prescription.issued_at = timezone.now()
        prescription.save()

        serializer = PrescriptionDetailSerializer(prescription)
        return Response({
            'message': '처방전이 발행되었습니다.',
            'prescription': serializer.data
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """처방전 취소"""
        prescription = self.get_object()

        if prescription.status in [Prescription.Status.DISPENSED, Prescription.Status.CANCELLED]:
            return Response(
                {'detail': '이미 조제 완료되었거나 취소된 처방전입니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = PrescriptionCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        prescription.status = Prescription.Status.CANCELLED
        prescription.cancelled_at = timezone.now()
        prescription.cancel_reason = serializer.validated_data['cancel_reason']
        prescription.save()

        detail_serializer = PrescriptionDetailSerializer(prescription)
        return Response({
            'message': '처방전이 취소되었습니다.',
            'prescription': detail_serializer.data
        })

    @action(detail=True, methods=['post'])
    def dispense(self, request, pk=None):
        """처방전 조제 완료 처리"""
        prescription = self.get_object()

        if prescription.status != Prescription.Status.ISSUED:
            return Response(
                {'detail': '발행된 처방전만 조제 완료 처리할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        prescription.status = Prescription.Status.DISPENSED
        prescription.dispensed_at = timezone.now()
        prescription.save()

        serializer = PrescriptionDetailSerializer(prescription)
        return Response({
            'message': '조제가 완료되었습니다.',
            'prescription': serializer.data
        })

    @action(detail=True, methods=['post'], url_path='items')
    def add_item(self, request, pk=None):
        """
        처방 항목 추가 (클릭 처방 지원)

        medication_id만 전달하면 기본값으로 자동 처방.
        용량, 빈도 등을 커스터마이즈하려면 함께 전달.
        """
        prescription = self.get_object()

        if not prescription.is_editable:
            return Response(
                {'detail': '발행된 처방전은 수정할 수 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = PrescriptionItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 순서 자동 설정
        max_order = prescription.items.aggregate(Max('order'))['order__max'] or 0

        # medication_id로 전달된 경우 medication 객체 사용
        validated_data = serializer.validated_data.copy()
        validated_data.pop('medication_id', None)  # medication_id 제거 (medication 객체가 이미 있음)

        item = PrescriptionItem.objects.create(
            prescription=prescription,
            order=max_order + 1,
            **validated_data
        )

        return Response(
            PrescriptionItemSerializer(item).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'], url_path='quick-prescribe')
    def quick_prescribe(self, request, pk=None):
        """
        클릭 한 번으로 의약품 처방 (간편 처방)

        의약품 ID만 전달하면 기본값으로 처방 항목 자동 생성.
        """
        prescription = self.get_object()

        if not prescription.is_editable:
            return Response(
                {'detail': '발행된 처방전은 수정할 수 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = QuickPrescribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item = serializer.create_prescription_item(prescription)

        return Response({
            'message': '의약품이 처방에 추가되었습니다.',
            'item': PrescriptionItemSerializer(item).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='items/(?P<item_id>[^/.]+)')
    def remove_item(self, request, pk=None, item_id=None):
        """처방 항목 삭제"""
        prescription = self.get_object()

        if not prescription.is_editable:
            return Response(
                {'detail': '발행된 처방전은 수정할 수 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            item = prescription.items.get(id=item_id)
            item.delete()
            return Response({'message': '항목이 삭제되었습니다.'})
        except PrescriptionItem.DoesNotExist:
            return Response(
                {'detail': '존재하지 않는 항목입니다.'},
                status=status.HTTP_404_NOT_FOUND
            )
