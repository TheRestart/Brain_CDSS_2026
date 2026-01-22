import re
from urllib import request
from django.contrib.auth import authenticate
from rest_framework import serializers
from apps.accounts.models import User
from apps.accounts.models.role import Role
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.utils import timezone
from django.db.models import F

from apps.accounts.models.role_permission_history import RolePermissionHistory
from apps.audit.services import create_audit_log
from apps.menus.models import MenuPermission
from apps.accounts.models import RolePermission

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = [
            "id", 
            "code", 
            "name", 
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_code(self, value):
        if not re.match(r'^[A-Z0-9_]+$', value):
            raise serializers.ValidationError(
                "역할 코드는 영문 대문자, 숫자, _ 만 사용할 수 있습니다."
            )
        return value

# 로그인 실패 최대 허용 횟수
MAX_LOGIN_FAIL = 5

# 로그인 관련 데이터를 JSON 타입의 데이터로 변환
class LoginSerializer(serializers.Serializer):
    login_id = serializers.CharField()
    password = serializers.CharField(write_only = True)
    
    def validate(self, data):
        request = self.context["request"]
        login_id = data.get("login_id")
        password = data.get("password")

        user = authenticate(login_id = login_id, password = password)
        
        data["login_locked"] = False
        
        # 로그인 실패
        if not user :
            qs = User.objects.filter(login_id=login_id)
            # 실패 횟수 증가 (존재하는 계정일 경우만)
            qs.update(
                failed_login_count=F("failed_login_count") + 1
            )

            user_obj = qs.first()
            remain = None

            if user_obj:
                # 로그인 남은 횟수 계산
                remain = max( MAX_LOGIN_FAIL - user_obj.failed_login_count, 0)
                
                # 로그인 잠금 발생 시
                if user_obj.failed_login_count >= MAX_LOGIN_FAIL:
                    qs.update(
                        is_locked=True,
                        locked_at=timezone.now()
                    )
                    create_audit_log(
                        request,
                        "LOGIN_LOCKED",
                        user_obj
                    )

                    raise serializers.ValidationError({
                        "code": "LOGIN_LOCKED",
                        "message": "로그인 실패 횟수 초과로 계정이 잠겼습니다. 관리자에게 문의하세요.",
                        "remain": 0,
                    })
                    
            # 일반 실패
            raise serializers.ValidationError({
                "code": "LOGIN_FAIL",
                "message": "아이디 또는 비밀번호가 올바르지 않습니다.",
                "remain": remain,
            })

        
        # 이미 잠긴 계정
        if user.is_locked:
            data["login_locked"] = True
            raise serializers.ValidationError({
                "code": "LOGIN_LOCKED",
                "message": "로그인 실패 횟수 초과로 계정이 잠겼습니다. 관리자에게 문의하세요.",
                "remain": 0,
            })

        # 비활성 계정
        if not user.is_active:
            raise serializers.ValidationError({
                "code": "INACTIVE_USER",
                "message": "비활성화된 계정입니다."
            })
            
        data["user"] = user
        return data
    

# 현재 사용자 정보(내 정보 조회) 데이터
class MeSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()
    role = RoleSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "login_id",
            "name",
            "email",
            "is_active",
            "is_staff",
            "role",
            "permissions",
            "must_change_password",
        )

    def get_permissions(self, obj):
        """
        프론트 hasPermission(menuCode) 에서 사용
        → Menu.code 리스트 반환

        부모 메뉴 권한이 있으면 자식(상세 페이지 등)도 자동 포함
        """
        if not obj.role:
            return []

        from apps.menus.models import Menu

        # 1. RolePermission에 직접 등록된 메뉴 ID 조회
        direct_menu_ids = set(
            RolePermission.objects
            .filter(role=obj.role)
            .values_list("permission_id", flat=True)
        )

        # 2. 직접 등록된 메뉴 + 그 자식 메뉴까지 모두 포함
        all_menu_ids = set(direct_menu_ids)

        def add_children(parent_ids):
            if not parent_ids:
                return
            child_ids = set(
                Menu.objects.filter(parent_id__in=parent_ids, is_active=True)
                .values_list("id", flat=True)
            )
            new_ids = child_ids - all_menu_ids
            all_menu_ids.update(new_ids)
            add_children(new_ids)  # 재귀적으로 자식의 자식도 포함

        add_children(direct_menu_ids)

        # 3. path가 있는 메뉴의 code만 반환 (실제 페이지)
        return list(
            Menu.objects.filter(
                id__in=all_menu_ids,
                is_active=True,
                path__isnull=False
            ).values_list("code", flat=True)
        )
# class MeSerializer(serializers.ModelSerializer) :
#     permissions = serializers.SerializerMethodField()
#     role = RoleSerializer(read_only=True)  # Role 전체 객체 직렬화

#     class Meta :
#         model = User
#         fields = (
#             "id",
#             "login_id",
#             "name",
#             "email",
#             "is_active",
#             "is_staff",
#             "role",
#             'permissions',
#             "must_change_password",
#         )
#     def get_permissions(self, obj):
#         """
#         프론트 hasPermission(menuCode)에서 쓰는 값
#         => menu.code 리스트로 내려줘야 함
#         """
#         if not obj.role:
#             return []
        
#         permissions = obj.role.permissions.all()

#         # menu_permission → menu → code 만 내려줌
#         return list(
#             MenuPermission.objects
#             .filter(is_active=True)
#             .values_list("menu__code", flat=True)
#     )

# 로그인 성공 시 last_login 갱신을 위한 커스텀 시리얼라이저
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):

    def validate(self, attrs):
        data = super().validate(attrs)

        # 로그인 성공 → last_login 갱신
        self.user.last_login = timezone.now()
        self.user.save(update_fields=["last_login"])
        
        # 프론트에 최소한의 사용자 정보 전달
        data["user"] = {
            "id": self.user.id,
            "login_id": self.user.login_id,
            "name": self.user.name,
            "email": self.user.email,
            "role": {
                "code": self.user.role.code if self.user.role else None,
                "name": self.user.role.name if self.user.role else None,
            },
            "must_change_password": self.user.must_change_password,
        }
        return data


# 역할별 메뉴 접근 변환 이력 관리
class RolePermissionHistorySerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.name", read_only=True)
    menu_name = serializers.CharField(source="menu.code", read_only=True)
    changed_by_name = serializers.CharField(
        source="changed_by.login_id",
        read_only=True
    )

    class Meta:
        model = RolePermissionHistory
        fields = [
            "id",
            "role_name",
            "menu_name",
            "action",
            "changed_by_name",
            "changed_at",
            "reason",
        ]