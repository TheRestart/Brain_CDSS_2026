from django.db.models import Q
from django.db import transaction
from .models import Patient


class PatientService:
    """환자 관리 비즈니스 로직"""

    @staticmethod
    def get_all_patients(filters=None):
        """환자 목록 조회"""
        queryset = Patient.objects.filter(is_deleted=False)

        if filters:
            q = filters.get('q')
            if q:
                queryset = queryset.filter(
                    Q(name__icontains=q) |
                    Q(patient_number__icontains=q) |
                    Q(phone__icontains=q)
                )

            status = filters.get('status')
            if status:
                queryset = queryset.filter(status=status)

            gender = filters.get('gender')
            if gender:
                queryset = queryset.filter(gender=gender)

            start_date = filters.get('start_date')
            end_date = filters.get('end_date')
            if start_date:
                queryset = queryset.filter(created_at__gte=start_date)
            if end_date:
                queryset = queryset.filter(created_at__lte=end_date)

        return queryset.select_related('registered_by')

    @staticmethod
    def get_patient_by_id(patient_id):
        """환자 상세 조회"""
        return Patient.objects.select_related('registered_by').get(
            id=patient_id,
            is_deleted=False
        )

    @staticmethod
    @transaction.atomic
    def create_patient(patient_data, registered_by):
        """환자 등록"""
        patient = Patient.objects.create(
            registered_by=registered_by,
            **patient_data
        )
        # TODO: Add audit log
        return patient

    @staticmethod
    @transaction.atomic
    def update_patient(patient_id, patient_data, updated_by):
        """환자 정보 수정"""
        patient = Patient.objects.get(id=patient_id, is_deleted=False)

        for key, value in patient_data.items():
            setattr(patient, key, value)

        patient.save()
        # TODO: Add audit log
        return patient

    @staticmethod
    @transaction.atomic
    def delete_patient(patient_id, deleted_by):
        """환자 삭제 (Soft Delete)"""
        patient = Patient.objects.get(id=patient_id, is_deleted=False)
        patient.is_deleted = True
        patient.status = 'inactive'
        patient.save()
        # TODO: Add audit log
        return patient

    @staticmethod
    def search_patients(query, limit=20):
        """
        환자 검색 (자동완성용)

        Args:
            query: 검색어 (이름, 환자번호, 전화번호)
            limit: 최대 결과 수

        Returns:
            QuerySet: 검색 결과
        """
        queryset = Patient.objects.filter(
            is_deleted=False
        ).filter(
            Q(name__icontains=query) |
            Q(patient_number__icontains=query) |
            Q(phone__icontains=query)
        ).select_related('registered_by').order_by('name')[:limit]

        return queryset

    @staticmethod
    def get_patient_statistics():
        """환자 통계 조회"""
        from django.db.models import Count

        total = Patient.objects.filter(is_deleted=False).count()
        active = Patient.objects.filter(status='active', is_deleted=False).count()
        inactive = Patient.objects.filter(status='inactive', is_deleted=False).count()

        by_gender = Patient.objects.filter(is_deleted=False).values('gender').annotate(
            count=Count('id')
        )

        return {
            'total': total,
            'active': active,
            'inactive': inactive,
            'by_gender': list(by_gender),
        }
