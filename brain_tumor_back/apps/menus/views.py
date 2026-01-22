from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .services import get_user_menus
from .utils import build_menu_tree


# 메뉴 API
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def UserMenuView(request):
    user = request.user
    
    # 접근 가능한 메뉴 조회
    menus = get_user_menus(user)

    # 트리로 변환
    menu_tree = build_menu_tree(menus)

    return Response({
        "menus": menu_tree
    })