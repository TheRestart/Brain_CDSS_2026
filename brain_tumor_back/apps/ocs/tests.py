from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from apps.accounts.models import User, Role
from apps.patients.models import Patient
from .models import OCS, OCSHistory


class OCSModelTest(TestCase):
    """OCS 모델 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        # Role 생성
        self.doctor_role = Role.objects.create(code='DOCTOR', name='의사')
        self.ris_role = Role.objects.create(code='RIS', name='영상의학')

        # User 생성
        self.doctor = User.objects.create_user(
            username='doctor1',
            password='testpass123',
            email='doctor@test.com',
            role=self.doctor_role
        )
        self.ris_worker = User.objects.create_user(
            username='ris1',
            password='testpass123',
            email='ris@test.com',
            role=self.ris_role
        )

        # Patient 생성
        self.patient = Patient.objects.create(
            name='테스트환자',
            birth_date='1990-01-01',
            gender='M',
            phone='010-1234-5678',
            ssn='9001011234567'
        )

    def test_ocs_creation(self):
        """OCS 생성 테스트"""
        ocs = OCS.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            job_role='RIS',
            job_type='MRI'
        )

        self.assertEqual(ocs.ocs_status, OCS.OcsStatus.ORDERED)
        self.assertEqual(ocs.priority, OCS.Priority.NORMAL)
        self.assertIsNotNone(ocs.ocs_id)
        self.assertTrue(ocs.ocs_id.startswith('ocs_'))

    def test_ocs_id_auto_generation(self):
        """OCS ID 자동 생성 테스트"""
        ocs1 = OCS.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            job_role='RIS',
            job_type='MRI'
        )
        ocs2 = OCS.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            job_role='LIS',
            job_type='BLOOD'
        )

        self.assertNotEqual(ocs1.ocs_id, ocs2.ocs_id)

    def test_ocs_default_templates(self):
        """기본 템플릿 테스트"""
        ocs = OCS(job_role='RIS')

        doctor_request = ocs.get_default_doctor_request()
        self.assertEqual(doctor_request['_template'], 'default')
        self.assertEqual(doctor_request['_version'], '1.0')

        worker_result = ocs.get_default_worker_result()
        self.assertEqual(worker_result['_template'], 'RIS')
        self.assertIn('dicom', worker_result)

    def test_ocs_editable_status(self):
        """수정 가능 상태 테스트"""
        ocs = OCS.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            job_role='RIS',
            job_type='MRI'
        )

        # ORDERED 상태에서는 수정 가능
        self.assertTrue(ocs.is_editable)

        # CONFIRMED 상태에서는 수정 불가
        ocs.ocs_status = OCS.OcsStatus.CONFIRMED
        self.assertFalse(ocs.is_editable)

        # CANCELLED 상태에서는 수정 불가
        ocs.ocs_status = OCS.OcsStatus.CANCELLED
        self.assertFalse(ocs.is_editable)


class OCSHistoryModelTest(TestCase):
    """OCS History 모델 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.doctor_role = Role.objects.create(code='DOCTOR', name='의사')
        self.doctor = User.objects.create_user(
            username='doctor1',
            password='testpass123',
            email='doctor@test.com',
            role=self.doctor_role
        )
        self.patient = Patient.objects.create(
            name='테스트환자',
            birth_date='1990-01-01',
            gender='M',
            phone='010-1234-5678',
            ssn='9001011234567'
        )

    def test_history_creation(self):
        """이력 생성 테스트"""
        ocs = OCS.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            job_role='RIS',
            job_type='MRI'
        )

        history = OCSHistory.objects.create(
            ocs=ocs,
            action=OCSHistory.Action.CREATED,
            actor=self.doctor,
            to_status=OCS.OcsStatus.ORDERED
        )

        self.assertEqual(history.ocs, ocs)
        self.assertEqual(history.action, OCSHistory.Action.CREATED)
        self.assertEqual(history.actor, self.doctor)


class OCSAPITest(APITestCase):
    """OCS API 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        # Role 생성
        self.doctor_role = Role.objects.create(code='DOCTOR', name='의사')
        self.ris_role = Role.objects.create(code='RIS', name='영상의학')
        self.admin_role = Role.objects.create(code='SYSTEMMANAGER', name='시스템관리자')

        # User 생성
        self.doctor = User.objects.create_user(
            username='doctor1',
            password='testpass123',
            email='doctor@test.com',
            role=self.doctor_role
        )
        self.ris_worker = User.objects.create_user(
            username='ris1',
            password='testpass123',
            email='ris@test.com',
            role=self.ris_role
        )
        self.admin = User.objects.create_user(
            username='admin1',
            password='testpass123',
            email='admin@test.com',
            role=self.admin_role
        )

        # Patient 생성
        self.patient = Patient.objects.create(
            name='테스트환자',
            birth_date='1990-01-01',
            gender='M',
            phone='010-1234-5678',
            ssn='9001011234567'
        )

        self.client = APIClient()

    def test_ocs_list_unauthenticated(self):
        """비인증 사용자 OCS 목록 조회 실패"""
        response = self.client.get('/api/ocs/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ocs_list_authenticated(self):
        """인증된 사용자 OCS 목록 조회"""
        self.client.force_authenticate(user=self.doctor)
        response = self.client.get('/api/ocs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_ocs_create_by_doctor(self):
        """의사가 OCS 생성"""
        self.client.force_authenticate(user=self.doctor)
        data = {
            'patient_id': self.patient.id,
            'job_role': 'RIS',
            'job_type': 'MRI',
            'priority': 'normal'
        }
        response = self.client.post('/api/ocs/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['ocs_status'], 'ORDERED')

    def test_ocs_create_by_non_doctor(self):
        """비의사가 OCS 생성 시도 (실패)"""
        self.client.force_authenticate(user=self.ris_worker)
        data = {
            'patient_id': self.patient.id,
            'job_role': 'RIS',
            'job_type': 'MRI'
        }
        response = self.client.post('/api/ocs/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_ocs_workflow(self):
        """OCS 워크플로우 테스트 (생성 → 접수 → 시작 → 제출 → 확정)"""
        # 1. 의사가 OCS 생성
        self.client.force_authenticate(user=self.doctor)
        data = {
            'patient_id': self.patient.id,
            'job_role': 'RIS',
            'job_type': 'MRI'
        }
        response = self.client.post('/api/ocs/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ocs_id = response.data['id']

        # 2. RIS 작업자가 접수
        self.client.force_authenticate(user=self.ris_worker)
        response = self.client.post(f'/api/ocs/{ocs_id}/accept/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['ocs_status'], 'ACCEPTED')

        # 3. 작업 시작
        response = self.client.post(f'/api/ocs/{ocs_id}/start/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['ocs_status'], 'IN_PROGRESS')

        # 4. 결과 제출
        response = self.client.post(f'/api/ocs/{ocs_id}/submit_result/', {
            'worker_result': {'impression': '정상 소견'}
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['ocs_status'], 'RESULT_READY')

        # 5. 의사가 확정
        self.client.force_authenticate(user=self.doctor)
        response = self.client.post(f'/api/ocs/{ocs_id}/confirm/', {
            'ocs_result': True
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['ocs_status'], 'CONFIRMED')
        self.assertTrue(response.data['ocs_result'])

    def test_ocs_cancel_by_doctor(self):
        """의사가 OCS 취소"""
        # OCS 생성
        self.client.force_authenticate(user=self.doctor)
        data = {
            'patient_id': self.patient.id,
            'job_role': 'RIS',
            'job_type': 'MRI'
        }
        response = self.client.post('/api/ocs/', data, format='json')
        ocs_id = response.data['id']

        # 취소
        response = self.client.post(f'/api/ocs/{ocs_id}/cancel/', {
            'cancel_reason': '환자 요청'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['ocs_status'], 'CANCELLED')
        self.assertEqual(response.data['cancel_reason'], '환자 요청')

    def test_ocs_cancel_by_worker(self):
        """작업자가 작업 취소 (작업 포기)"""
        # OCS 생성 (의사)
        self.client.force_authenticate(user=self.doctor)
        data = {
            'patient_id': self.patient.id,
            'job_role': 'RIS',
            'job_type': 'MRI'
        }
        response = self.client.post('/api/ocs/', data, format='json')
        ocs_id = response.data['id']

        # 접수 (작업자)
        self.client.force_authenticate(user=self.ris_worker)
        self.client.post(f'/api/ocs/{ocs_id}/accept/')

        # 취소 (작업 포기)
        response = self.client.post(f'/api/ocs/{ocs_id}/cancel/', {
            'cancel_reason': '개인 사유'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # 작업자 취소는 ORDERED로 복구
        self.assertEqual(response.data['ocs_status'], 'ORDERED')
        self.assertIsNone(response.data['worker'])

    def test_ocs_history(self):
        """OCS 이력 조회"""
        # OCS 생성
        self.client.force_authenticate(user=self.doctor)
        data = {
            'patient_id': self.patient.id,
            'job_role': 'RIS',
            'job_type': 'MRI'
        }
        response = self.client.post('/api/ocs/', data, format='json')
        ocs_id = response.data['id']

        # 이력 조회
        response = self.client.get(f'/api/ocs/{ocs_id}/history/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)
        self.assertEqual(response.data[0]['action'], 'CREATED')

    def test_ocs_filter_by_status(self):
        """상태별 필터링"""
        self.client.force_authenticate(user=self.doctor)

        # OCS 생성
        for _ in range(3):
            self.client.post('/api/ocs/', {
                'patient_id': self.patient.id,
                'job_role': 'RIS',
                'job_type': 'MRI'
            }, format='json')

        # ORDERED 상태만 조회
        response = self.client.get('/api/ocs/?ocs_status=ORDERED')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for ocs in response.data['results']:
            self.assertEqual(ocs['ocs_status'], 'ORDERED')
