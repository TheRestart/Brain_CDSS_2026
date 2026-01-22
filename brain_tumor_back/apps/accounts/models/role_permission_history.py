from django.db import models
from apps.common.middleware import User
from .role import Role
from apps.menus.models import Menu

class RolePermissionHistory(models.Model):
    ACTION_CHOICES = (
        ("ADD", "권한 추가"),
        ("REMOVE", "권한 제거"),
    )

    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE)

    action = models.CharField(max_length=10, choices=ACTION_CHOICES)

    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="permission_changes"
    )
    
    changed_at = models.DateTimeField(auto_now_add=True)
    reason = models.CharField(max_length=255, blank=True)
