from django.db import models
from .user import User

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    birthDate = models.DateField(null=True, blank=True)
    phoneMobile = models.CharField(max_length=20, null=True, blank=True)
    phoneOffice = models.CharField(max_length=20, null=True, blank=True)
    hireDate = models.DateField(null=True, blank=True)

    departmentId = models.IntegerField(null=True, blank=True)
    title = models.CharField(max_length=100, null=True, blank=True)

    # 부서/근무지 정보
    department = models.CharField(max_length=100, null=True, blank=True, verbose_name='부서')
    workStation = models.CharField(max_length=200, null=True, blank=True, verbose_name='근무지')
    
    createdAt = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.login_id} profile"