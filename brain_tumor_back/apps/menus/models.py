from django.db import models
from django.conf import settings
from apps.accounts.models.permission import Permission

# Menu 모델 설계(메뉴 + 역할 매핑)

# 메뉴 기본 정보 (path, icon, parent-child 구조)
class Menu(models.Model):
    id = models.BigAutoField(primary_key=True)  # PK는 숫자형
    code = models.CharField(max_length=50, unique=True, default="DEFAULT")  # 'DASHBOARD', 'ADMIN' 등
    path = models.CharField(max_length=200, blank=True, null=True)
    icon = models.CharField(max_length=50, blank=True, null=True)
    group_label = models.CharField(max_length=100, blank=True, null=True)
    breadcrumb_only = models.BooleanField(default=False)
    parent = models.ForeignKey("self", related_name="children", on_delete=models.CASCADE, blank=True, null=True)
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.code
# class Menu(models.Model):
#     menu_id = models.CharField(max_length=50, primary_key=True) # ex: 'DASHBOARD'
#     path = models.CharField(max_length=200, blank=True, null=True)
#     icon = models.CharField(max_length=50, blank=True, null=True)
#     group_label = models.CharField(max_length=100, blank=True, null=True)
#     breadcrumb_only = models.BooleanField(default=False) # 사이드바에서 보이게 하려면 false
    
#     parent = models.ForeignKey(
#         "self",
#         related_name="children",
#         on_delete=models.CASCADE,
#         blank=True,
#         null=True
#     )

#     order = models.IntegerField(default=0)
#     is_active = models.BooleanField(default=True)
    
#     def __str__(self):
#         return self.id
    

# 역할별 라벨 텍스트
class MenuLabel(models.Model):
    menu = models.ForeignKey(Menu, related_name="labels", on_delete=models.CASCADE)
    role = models.CharField(max_length=50)  # ex: 'DOCTOR', 'NURSE', 'DEFAULT'
    text = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.menu.id} - {self.role}: {self.text}"


# 접근 가능한 역할(Role)
# class MenuRole(models.Model):
#     menu = models.ForeignKey(Menu, related_name="roles", on_delete=models.CASCADE)
#     role = models.CharField(max_length=50)  # ex: 'DOCTOR', 'NURSE', 'ADMIN'

#     def __str__(self):
#         return f"{self.menu.id} - {self.role}"


# 메뉴와 Permission 매핑 (권한 기반 접근 제어)
class MenuPermission(models.Model):
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    
    class Meta:
        unique_together = ("menu", "permission")