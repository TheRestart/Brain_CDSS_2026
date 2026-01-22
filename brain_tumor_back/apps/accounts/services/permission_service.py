# 권한 변경 시 이벤트 발행 => 권한 변경 로직 마지막에 이 함수 호출

from ..models import UserRole, RolePermission
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

# 이벤트 발행 로직 (Channels를 통한 WebSocket 알림)
def notify_permission_changed(user_id):
    channel_layer = get_channel_layer()

    async_to_sync(channel_layer.group_send)(
        f"user_{user_id}",
        {
            "type" : "permission_changed",
        }
    )

# 사용자 권한 조회 로직
def get_user_permission(user):
    role_ids = UserRole.objects.filter(user = user).values_list("role_id", flat= True)
    permission = RolePermission.objects.filter(
        role_id__in = role_ids
    ).values_list("permission__code", flat=True)

    return list(permission)
    