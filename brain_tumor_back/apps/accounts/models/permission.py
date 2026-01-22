from django.db import models

# Permission(메뉴 접근 허가) 모델
class Permission(models.Model):
    code = models.CharField(max_length=100, unique=True) # 환자 상세조회, 영상 조회 등등
    name = models.CharField(max_length= 100)
    description = models.TextField(blank=True)
    
    def __str__(self):
        return self.code