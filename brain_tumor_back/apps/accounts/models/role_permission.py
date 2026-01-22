from django.db import models
from .role import Role
from apps.menus.models import Menu


class RolePermission(models.Model):
    """
    Role - Menu 권한 매핑 (실제 사용 모델)
    """
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE
    )
    permission = models.ForeignKey(
        Menu,
        on_delete=models.CASCADE
    )

    class Meta:
        db_table = "accounts_role_permissions"
        unique_together = ("role", "permission")
        managed = True   # Django가 이 테이블을 관리?
