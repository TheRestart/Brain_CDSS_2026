from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ChangePasswordView, LoginView, MeView, RoleViewSet, PermissionViewSet
from apps.menus.views import UserMenuView 

router = DefaultRouter()
router.register(r'roles', RoleViewSet)
router.register(r"permissions", PermissionViewSet, basename="permission")

# 함수형 뷰라면 .as_view() 미작성 
# 클래스 기반 뷰라면 .as_view()를 사용
urlpatterns = [
    path("login/", LoginView.as_view(), name="login"), # 로그인
    path("me/", MeView.as_view(), name="me"), # 로그인 사용자 정보 조회 
    path("menu/", UserMenuView, name="user-menu"),  # 사용자 메뉴 조회
    path("change-password/", ChangePasswordView.as_view()), # 비밀번호 변경
    path("", include(router.urls)), # 역할 관리, 메뉴 권한 관리    
]
