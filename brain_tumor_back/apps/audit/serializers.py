from rest_framework import serializers
from .models import AuditLog, AccessLog


class AuditLogSerializer(serializers.ModelSerializer):
    """인증 감사 로그 조회용 Serializer"""
    user_login_id = serializers.CharField(source='user.login_id', read_only=True, allow_null=True)
    user_name = serializers.CharField(source='user.name', read_only=True, allow_null=True)
    user_role = serializers.CharField(source='user.role.name', read_only=True, allow_null=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'user',
            'user_login_id',
            'user_name',
            'user_role',
            'action',
            'action_display',
            'ip_address',
            'user_agent',
            'created_at',
        ]
        read_only_fields = fields


class AccessLogSerializer(serializers.ModelSerializer):
    """접근 감사 로그 목록 조회용 Serializer"""
    user_login_id = serializers.CharField(source='user.login_id', read_only=True, allow_null=True)
    user_name = serializers.CharField(source='user.name', read_only=True, allow_null=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    result_display = serializers.CharField(source='get_result_display', read_only=True)

    class Meta:
        model = AccessLog
        fields = [
            'id',
            'user',
            'user_login_id',
            'user_name',
            'user_role',
            'action',
            'action_display',
            'menu_name',
            'request_method',
            'request_path',
            'ip_address',
            'result',
            'result_display',
            'response_status',
            'created_at',
        ]
        read_only_fields = fields


class AccessLogDetailSerializer(serializers.ModelSerializer):
    """접근 감사 로그 상세 조회용 Serializer"""
    user_login_id = serializers.CharField(source='user.login_id', read_only=True, allow_null=True)
    user_name = serializers.CharField(source='user.name', read_only=True, allow_null=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    result_display = serializers.CharField(source='get_result_display', read_only=True)

    class Meta:
        model = AccessLog
        fields = [
            'id',
            'user',
            'user_login_id',
            'user_name',
            'user_role',
            'action',
            'action_display',
            'menu_name',
            'request_method',
            'request_path',
            'request_params',
            'ip_address',
            'user_agent',
            'result',
            'result_display',
            'fail_reason',
            'response_status',
            'duration_ms',
            'created_at',
        ]
        read_only_fields = fields
