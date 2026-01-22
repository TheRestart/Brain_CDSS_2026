from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Role, Permission, UserRole, RolePermission

# admin 페이지 연결
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    # 목록에 표시할 필드
    list_display = ("login_id", "name", "email", "role", "is_active", "is_staff", "last_login")
    search_fields = ("login_id", "name", "email")
    ordering = ("login_id",)

    # 상세 화면에서 보여줄 필드 그룹
    fieldsets = (
        (None, {"fields": ("login_id", "password")}),
        ("개인정보", {"fields": ("name", "email", "role")}),
        ("권한", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("기록", {"fields": ("last_login", "created_at", "updated_at")}),
    )

    # 사용자 추가 화면에서 보여줄 필드
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("login_id", "name", "email", "role", "password1", "password2", "is_active", "is_staff", "is_superuser"),
        }),
    )

