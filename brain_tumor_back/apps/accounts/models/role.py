from django.db import models

# Role 모델
class Role(models.Model):
    code = models.CharField(max_length=50, unique = True) # Doctor, Nurse, Patient, LIS, RIS, Admin
    name = models.CharField(max_length=50)
    description = models.TextField(blank= True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add = True)
    updated_at = models.DateTimeField(auto_now=True)

    # 참고: Role-Menu 권한 매핑은 RolePermission 모델을 통해 관리됨
    # (apps/accounts/models/role_permission.py 참조)

    def __str__(self) :
        return self.name

