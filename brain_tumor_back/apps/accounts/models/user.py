from django.db import models
from django.contrib.auth.models import(
    BaseUserManager,   
    AbstractBaseUser,
    PermissionsMixin,
)
from .role import Role

# 최상위 관리자 모델 
class UserManager(BaseUserManager):
    def create_user(self, login_id, password=None, role=None, **extra_fields):
        if not login_id:
            raise ValueError("ID는 필수 항목")
        
        user = self.model(login_id = login_id,  role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, login_id, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        
        # role 기본값 지정
        try:
            system_role = Role.objects.get(code="SYSTEMMANAGER")
        except Role.DoesNotExist:
            system_role = None
        extra_fields.setdefault("role", system_role)

        # extra_fields.setdefault("role_id", 1)  # SYSTEMMANAGER 역할 ID

        
        return self.create_user(login_id, password, **extra_fields)


ROLE_CHOICES = (
    ("ADMIN", "관리자"),
    ("DOCTOR", "의사"),
    ("NURSE", "간호사"),
    ("RIS", "영상의학과"),
    ("LIS", "검사실"),
    ("PATIENT", "환자"),
)

# User 모델
class User(AbstractBaseUser, PermissionsMixin):
    login_id = models.CharField(max_length=50, unique = True)
    must_change_password = models.BooleanField(default=False)
    
    name = models.CharField(max_length=50)
    email = models.EmailField(blank=True, null= True)
    
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    
    role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )  
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    failed_login_count = models.PositiveIntegerField(default=0)  # 로그인 실패 횟수
    is_locked = models.BooleanField(default=False)   # 자동 잠금 여부
    locked_at = models.DateTimeField(null=True, blank=True)  # 계정 잠금 시각
    
    # 충돌 방지 : related_name 지정
    groups = models.ManyToManyField(
        "auth.Group",
        related_name= "custom_user_groups",
        blank= True
    )
    user_permissions = models.ManyToManyField(
        "auth.Permission",
        related_name="custom_user_permissions",
        blank=True,
    )
    
    objects = UserManager()
    
    # 마지막 로그인 IP 주소
    last_login_ip = models.GenericIPAddressField(
        null=True,
        blank=True
    )
    
    last_seen = models.DateTimeField(null=True, blank=True)

    
    USERNAME_FIELD = "login_id"
    REQUIRED_FIELDS = ["name"]
    
    def __str__(self):
        return self.login_id