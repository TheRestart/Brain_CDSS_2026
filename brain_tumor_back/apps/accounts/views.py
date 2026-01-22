# 비즈니스 로직 (권한 변경 처리)
# apps/accounts/views.py → 요청을 받아서 서비스 함수를 호출
from django.shortcuts import get_object_or_404
from rest_framework import generics, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import User
from .serializers import (
    UserSerializer,
    UserCreateUpdateSerializer,
    UserUpdateSerializer,
    MyProfileSerializer,
    MyProfileUpdateSerializer,
    ChangePasswordSerializer,
)
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from django.db.models import BooleanField, Case, When, Value
from apps.common.pagination import UserPagination
from .filters import UserFilter

ALLOWED_CREATE_ROLES = {"ADMIN", "SYSTEMMANAGER"}
# 1. 사용자 목록 조회 & 추가 API(관리자 전용 view)
# 검색, 필터, 생성, 온라인 상태
class UserListView(generics.ListCreateAPIView):
    # permission_classes = [IsAdminUser]
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer
    pagination_class = UserPagination
    
    filter_backends = [
        filters.SearchFilter,
        DjangoFilterBackend,
    ]

    search_fields = ["login_id", "name"] # 검색 필드 설정
    filterset_class = UserFilter  # 필터링 필드 설정
    # /api/users/?search=doctor01 → ID 검색
    # /api/users/?search=홍길동 → 이름 검색
    # /api/users/?role=DOCTOR → 역할 필터링
    # /api/users/?is_active=true → 활성 사용자만 조회
    # filterset_fields = ["role__code", "is_active"]
    
    def get_queryset(self):
        qs = User.objects.select_related("role")

        online_threshold = timezone.now() - timedelta(seconds=60)

        qs = qs.annotate(
            is_online=Case(
                When(last_seen__gte=online_threshold, then=Value(True)),
                default=Value(False),
                output_field=BooleanField(),
            )
        )
        return qs
    
    # 사용자 생성
    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserCreateUpdateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        if request.user.role.code not in ALLOWED_CREATE_ROLES :
            return Response(
                {"detail": "관리자만 사용자 생성이 가능합니다."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

# 2. 사용자 상세 조회(GET) & 수정(PUT) & 삭제(DELETE) API
class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    def get_serializer_class(self):
        # 사용자 수정(PUT)
        if self.request.method in ["PUT", "PATCH"]:
            return UserUpdateSerializer
        return UserSerializer

# 3. 사용자 활성/비활성 토글
class UserToggleActiveView(APIView):
    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        user.is_active = not user.is_active
        user.save()
        return Response({"id": user.id, "is_active": user.is_active})

# 4. 사용자 계정 잠금 해제
class UnlockUserView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        user = get_object_or_404(User, pk=pk)

        user.is_locked = False
        user.failed_login_count = 0
        user.locked_at = None
        user.save()

        return Response({"detail": "계정 잠금 해제 완료"})


# ========== MyPage Views ==========

# 5. 내 정보 조회 및 수정 (GET /api/accounts/me/, PUT /api/accounts/me/)
class MyProfileView(APIView):
    """
    내 프로필 조회 및 수정

    GET: 현재 로그인한 사용자의 정보 조회
    PUT: 이름, 이메일, 프로필 정보 수정
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = MyProfileSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = MyProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            serializer.save()
            # 수정 후 전체 정보 반환
            return Response(MyProfileSerializer(request.user).data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# 6. 비밀번호 변경 (POST /api/accounts/me/change-password/)
class ChangePasswordView(APIView):
    """
    비밀번호 변경

    POST: 현재 비밀번호 확인 후 새 비밀번호로 변경
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )

        if serializer.is_valid():
            serializer.save()
            return Response({"detail": "비밀번호가 성공적으로 변경되었습니다."})

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ========== External Institution Views ==========

# 7. 외부기관(EXTERNAL 역할) 사용자 목록 조회
class ExternalInstitutionListView(APIView):
    """
    외부기관(EXTERNAL 역할) 사용자 목록 조회

    GET: EXTERNAL 역할의 활성 사용자 목록 반환
    - 기관명(name), 기관코드(login_id) 형태로 제공
    - RIS 업로드 페이지에서 외부기관 선택 드롭다운용
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        external_users = User.objects.filter(
            role__code='EXTERNAL',
            is_active=True
        ).select_related('role').order_by('name')

        institutions = [
            {
                'id': user.id,
                'name': user.name,  # 기관명
                'code': user.login_id,  # 기관코드 (login_id를 코드로 사용)
                'email': user.email or '',
            }
            for user in external_users
        ]

        return Response(institutions)

