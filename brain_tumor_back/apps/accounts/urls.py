from django.urls import path
from .views import (
    UnlockUserView,
    UserListView,
    UserDetailView,
    UserToggleActiveView,
    MyProfileView,
    ChangePasswordView,
    ExternalInstitutionListView,
)

# 사용자 관리 API 엔드포인트 정의
urlpatterns = [
    # 사용자 목록 및 생성 (관리자)
    path("", UserListView.as_view(), name="user-list"),

    # 내 정보 (MyPage)
    path("me/", MyProfileView.as_view(), name="my-profile"),
    path("me/change-password/", ChangePasswordView.as_view(), name="change-password"),

    # 외부기관(EXTERNAL 역할) 목록 조회
    path("external-institutions/", ExternalInstitutionListView.as_view(), name="external-institutions"),

    # 특정 사용자 상세 조회, 수정, 삭제 (관리자)
    path("<int:pk>/", UserDetailView.as_view(), name="user-detail"),
    path("<int:pk>/toggle-active/", UserToggleActiveView.as_view(), name="user_toggle_active"),
    path("<int:pk>/unlock/", UnlockUserView.as_view(), name="user-unlock"),
]
