from rest_framework import permissions


class OCSPermission(permissions.BasePermission):
    """
    OCS 권한 체크

    - 모든 인증된 사용자: 목록 조회, 상세 조회
    - DOCTOR: OCS 생성, 확정, 취소
    - job_role 일치 작업자: 접수, 시작, 결과 저장/제출
    - SYSTEMMANAGER, ADMIN: 전체 권한
    """

    ADMIN_ROLES = ['SYSTEMMANAGER', 'ADMIN']
    WORKER_ROLES = ['RIS', 'LIS', 'TREATMENT', 'CONSULT']

    def has_permission(self, request, view):
        """기본 권한 체크"""
        if not request.user or not request.user.is_authenticated:
            return False

        # 관리자는 전체 권한
        user_role = getattr(request.user, 'role', None)
        if user_role and user_role.code in self.ADMIN_ROLES:
            return True

        # 읽기 작업은 모든 인증된 사용자 허용
        if view.action in ['list', 'retrieve', 'by_ocs_id', 'pending',
                          'by_patient', 'by_doctor', 'by_worker', 'history']:
            return True

        # 생성은 의사만
        if view.action == 'create':
            return user_role and user_role.code == 'DOCTOR'

        # 나머지는 object-level에서 체크
        return True

    def has_object_permission(self, request, view, obj):
        """객체 수준 권한 체크"""
        user = request.user
        user_role = getattr(user, 'role', None)
        role_code = user_role.code if user_role else None

        # 관리자는 전체 권한
        if role_code in self.ADMIN_ROLES:
            return True

        # 읽기 작업은 모든 인증된 사용자 허용
        if view.action in ['retrieve', 'history']:
            return True

        # 수정/삭제는 의사만 (자신이 생성한 것)
        if view.action in ['update', 'partial_update', 'destroy']:
            return obj.doctor == user

        # 접수는 job_role이 일치하는 작업자만
        if view.action == 'accept':
            return role_code == obj.job_role or role_code in self.ADMIN_ROLES

        # 시작, 저장, 제출은 현재 작업자만
        if view.action in ['start', 'save_result', 'submit_result']:
            return obj.worker == user

        # 확정은 처방 의사 또는 LIS/RIS 담당자
        if view.action == 'confirm':
            is_doctor = obj.doctor == user
            is_lis_ris_worker = obj.worker == user and obj.job_role in ['LIS', 'RIS']
            return is_doctor or is_lis_ris_worker

        # 취소는 의사 또는 작업자
        if view.action == 'cancel':
            return obj.doctor == user or obj.worker == user

        # LIS/RIS 파일 업로드는 현재 작업자 또는 job_role이 일치하는 사용자
        if view.action in ['upload_lis_file', 'upload_ris_file']:
            is_worker = obj.worker == user
            is_matching_role = role_code == obj.job_role
            return is_worker or is_matching_role

        return False


class IsOCSDoctor(permissions.BasePermission):
    """OCS 처방 의사 권한"""

    def has_object_permission(self, request, view, obj):
        return obj.doctor == request.user


class IsOCSWorker(permissions.BasePermission):
    """OCS 현재 작업자 권한"""

    def has_object_permission(self, request, view, obj):
        return obj.worker == request.user


class CanAcceptOCS(permissions.BasePermission):
    """OCS 접수 가능 권한 (job_role 일치)"""

    ADMIN_ROLES = ['SYSTEMMANAGER', 'ADMIN']

    def has_object_permission(self, request, view, obj):
        user_role = getattr(request.user, 'role', None)
        if not user_role:
            return False

        # 관리자는 전체 권한
        if user_role.code in self.ADMIN_ROLES:
            return True

        # job_role 일치 체크
        return user_role.code == obj.job_role
