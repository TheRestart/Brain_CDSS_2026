from .models import Menu, MenuPermission
from apps.accounts.services.permission_service import get_user_permission
from apps.accounts.models import RolePermission

# 특정 유저가 접근 가능한 메뉴를 반환하는 함수.
def get_user_menus(user):
    role = user.role

    # 1. RolePermission에 직접 등록된 메뉴 ID 조회
    direct_menu_ids = set(
        RolePermission.objects
        .filter(role=role)
        .values_list("permission_id", flat=True)
    )

    # 2. 직접 등록된 메뉴 + 그 자식 메뉴까지 모두 포함 (상세 페이지 등)
    all_menu_ids = set(direct_menu_ids)

    def add_children(parent_ids):
        if not parent_ids:
            return
        child_ids = set(
            Menu.objects.filter(parent_id__in=parent_ids, is_active=True)
            .values_list("id", flat=True)
        )
        new_ids = child_ids - all_menu_ids
        all_menu_ids.update(new_ids)
        add_children(new_ids)  # 재귀적으로 자식의 자식도 포함

    add_children(direct_menu_ids)

    # 3. 부모 메뉴까지 재귀적으로 포함 (사이드바 트리 구성용)
    def add_parents(menu_ids):
        parent_ids = set(
            Menu.objects.filter(id__in=menu_ids, parent__isnull=False)
            .values_list("parent_id", flat=True)
        )
        new_parents = parent_ids - all_menu_ids
        if new_parents:
            all_menu_ids.update(new_parents)
            add_parents(new_parents)

    add_parents(all_menu_ids.copy())

    # 4. 메뉴 조회 (breadcrumb_only 포함 - 라우팅/권한 체크용)
    # 사이드바 표시 여부는 프론트엔드에서 breadcrumbOnly 필드로 결정
    menus = (
        Menu.objects.filter(
            is_active=True,
            id__in=all_menu_ids,
        )
        .select_related("parent")
        .prefetch_related("children", "labels")
        .order_by("order")
    )
    return menus

# 주어진 권한 코드로 접근 가능한 메뉴를 반환하는 함수.
def get_accessible_menus(permission_codes: list[str]):
    """
    permission_codes:
      ['VIEW_DASHBOARD', 'VIEW_PATIENT_LIST', ...]
    """

    menus = (
        Menu.objects
        .filter(
            is_active=True,
            menupermission__permission__code__in=permission_codes
        )
        .distinct()
        .select_related("parent")
        .prefetch_related("children")
        .order_by("order")
    )

    return menus