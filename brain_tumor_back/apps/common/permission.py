from rest_framework.permissions import BasePermission
from apps.accounts.services.permission_service import get_user_permission

# API 권한 체크용 Permission 클래스
class HasPermission(BasePermission):
    required_permission = None

    def has_permission(self, request, view):
        if not self.required_permission:
            return True

        user_permission = get_user_permission(request.user)
        return self.required_permission in user_permission


class IsAdmin(BasePermission):
    """ADMIN 또는 SYSTEMMANAGER 역할만 접근 가능"""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not request.user.role:
            return False
        return request.user.role.code in ['ADMIN', 'SYSTEMMANAGER']


class IsExternal(BasePermission):
    """EXTERNAL 역할(외부기관)만 접근 가능"""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not request.user.role:
            return False
        return request.user.role.code == 'EXTERNAL'


class IsExternalOrAdmin(BasePermission):
    """EXTERNAL, ADMIN, SYSTEMMANAGER 역할 접근 가능 (관리자가 외부기관 현황 조회용)"""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not request.user.role:
            return False
        return request.user.role.code in ['EXTERNAL', 'ADMIN', 'SYSTEMMANAGER']


class IsDoctor(BasePermission):
    """DOCTOR 역할만 접근 가능"""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not request.user.role:
            return False
        return request.user.role.code == 'DOCTOR'


class IsDoctorOrAdmin(BasePermission):
    """DOCTOR, ADMIN, SYSTEMMANAGER 역할 접근 가능 (관리자가 의사 현황 조회용)"""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not request.user.role:
            return False
        return request.user.role.code in ['DOCTOR', 'ADMIN', 'SYSTEMMANAGER']