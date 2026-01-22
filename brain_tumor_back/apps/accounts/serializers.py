import logging

logger = logging.getLogger(__name__)
from rest_framework.exceptions import ValidationError
from rest_framework import serializers
from apps.authorization.serializers import RoleSerializer
from .models import User, Role, UserProfile
from django.db import transaction
from django.core.mail import send_mail
from django.conf import settings
import secrets
import string

# Serialzer는 데이터 변환

class UserProfileSerializer(serializers.ModelSerializer):
    departmentId = serializers.IntegerField(required=False, allow_null=True)
    class Meta:
        model = UserProfile
        fields = [
            "birthDate",
            "phoneMobile",
            "phoneOffice",
            "hireDate",
            "departmentId",
            "title",
            "department",
            "workStation",
        ]


# 사용자 모델을 JSON 타입의 데이터로 변환
class UserSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    is_online = serializers.BooleanField(read_only=True)
    profile = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = [
            "id"
            , "login_id"
            , "name"
            , "email"
            , "role"
            , "is_active"
            , "is_staff"
            , "is_superuser"
            , "last_login"
            , "created_at"
            , "updated_at"
            , "is_locked"
            , "failed_login_count"
            , "last_login_ip"
            , "is_online"
            , "profile"
            , "must_change_password"
        ]
    def get_role(self, obj):
        if not obj.role:
            return None
        return {
            "code": obj.role.code,
            "name": obj.role.name,
    }

# 사용자 생성/수정 시리얼라이저
# 임시 비밀번호 생성 함수
def generate_temp_password(length=12):
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(chars) for _ in range(length))

class UserCreateUpdateSerializer(serializers.ModelSerializer):    
    role = serializers.CharField(write_only=True)
    profile = UserProfileSerializer(write_only=True)

    class Meta:
        model = User
        fields = [
            "login_id"
            , "name"
            , "email"
            , "role"
            , "is_active"
            , "profile"
        ]
    
    
    @transaction.atomic
    def create(self, validated_data):
        # role 처리
        role_code = validated_data.pop("role")
        # role = Role.objects.get(code=role_code) # 역할 코드로 역할 객체 조회
        try:
            role = Role.objects.get(code=role_code)
        except Role.DoesNotExist:
            raise ValidationError({"role": "유효하지 않은 역할입니다."})
        
        # 임시 비밀번호 생성 함수
        temp_password = generate_temp_password()
        
        # profile 데이터 분리
        profile_data = validated_data.pop("profile", None)
        
        # 사용자 생성
        # password = validated_data.pop("password")
        user = User(**validated_data)
        user.role = role
        user.set_password(temp_password)
        user.must_change_password = True
        user.save()
        
        # UserProfile 생성
        if profile_data:
            UserProfile.objects.create(
                user=user,
                **profile_data
            )
        user.save()

        # 이메일 발송
        try :
            send_mail(
                subject="[BrainTumor] 시스템 계정이 생성되었습니다",
                message=(
                    f"안녕하세요 {user.name}님,\n\n"
                    f"BrainTumor 시스템 계정이 생성되었습니다.\n\n"
                    f"아이디: {user.login_id}\n"
                    f"임시 비밀번호: {temp_password}\n\n"
                    f"※ 최초 로그인 시 비밀번호 변경이 필요합니다."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as e:
            # 로그만 남기고 사용자 생성은 유지
            logger.error(f"메일 발송 실패: {e}")
        
        return user
    
# 사용자 정보 수정
class UserUpdateSerializer(serializers.ModelSerializer):
    role = serializers.CharField(required=False)
    profile = UserProfileSerializer(required=False)
    login_id = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [ 
            "login_id",
            "name",
            "email",
            "role",
            "is_active",
            "profile",
        ]

    @transaction.atomic
    def update(self, instance, validated_data):
        # role 변경
        role_code = validated_data.pop("role", None)
        if role_code:
            try:
                instance.role = Role.objects.get(code=role_code)
            except Role.DoesNotExist:
                raise ValidationError({"role": "유효하지 않은 역할입니다."})

        # profile 업데이트
        profile_data = validated_data.pop("profile", None)
        if profile_data is not None:
            profile, _ = UserProfile.objects.get_or_create(user=instance)

            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        # user 기본 필드
        for key, value in validated_data.items():
            setattr(instance, key, value)

        instance.save()
        return instance


# ========== MyPage Serializers ==========

class MyProfileSerializer(serializers.ModelSerializer):
    """내 정보 조회용 Serializer"""
    role = RoleSerializer(read_only=True)
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "login_id",
            "name",
            "email",
            "role",
            "is_active",
            "last_login",
            "created_at",
            "profile",
        ]
        read_only_fields = ["id", "login_id", "role", "is_active", "last_login", "created_at"]


class MyProfileUpdateSerializer(serializers.ModelSerializer):
    """내 정보 수정용 Serializer (본인이 수정 가능한 필드만)"""
    profile = UserProfileSerializer(required=False)

    class Meta:
        model = User
        fields = [
            "name",
            "email",
            "profile",
        ]

    @transaction.atomic
    def update(self, instance, validated_data):
        # profile 업데이트
        profile_data = validated_data.pop("profile", None)
        if profile_data is not None:
            profile, _ = UserProfile.objects.get_or_create(user=instance)

            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        # user 기본 필드 (name, email만)
        for key, value in validated_data.items():
            setattr(instance, key, value)

        instance.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    """비밀번호 변경용 Serializer"""
    current_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate_current_password(self, value):
        """현재 비밀번호 검증"""
        user = self.context.get('request').user
        if not user.check_password(value):
            raise ValidationError("현재 비밀번호가 일치하지 않습니다.")
        return value

    def validate(self, data):
        """새 비밀번호 확인"""
        if data['new_password'] != data['confirm_password']:
            raise ValidationError({"confirm_password": "새 비밀번호가 일치하지 않습니다."})

        if data['current_password'] == data['new_password']:
            raise ValidationError({"new_password": "현재 비밀번호와 다른 비밀번호를 입력해주세요."})

        return data

    def save(self):
        """비밀번호 변경"""
        user = self.context.get('request').user
        user.set_password(self.validated_data['new_password'])
        user.must_change_password = False
        user.save()
        return user
