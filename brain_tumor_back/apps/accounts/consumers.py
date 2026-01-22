import os
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
import redis

# Redis 클라이언트 객체 생성 (환경변수 우선)
redis_host = os.environ.get('REDIS_HOST', '127.0.0.1')
redis_port = int(os.environ.get('REDIS_PORT', 6379))
redis_client = redis.Redis(host=redis_host, port=redis_port, db=0)

# 사용자 권한 변경 알림 Consumer
class UserPermissionConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        
        if user.is_anonymous :
            await self.close()
            return
        
        self.group_name = f"user_{user.id}"
        
        await self.accept()
    
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name,
        )
    
    async def permission_changed(self, event):
        await self.send_json({
            "type": "PERMISSION_CHANGED"
        })

# 사용자 접속 상태 관리 Consumer
class PresenceConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        
        if user.is_anonymous:
            await self.close()
            return

        self.user = user  # connect 시점에 user 상태 세팅

        await self.accept()

        # 최초 접속 시 last_seen 기록
        # await self.update_last_seen()

        # Redis에 온라인 상태 기록
        mark_user_online(user.id)

        await self.channel_layer.group_add(
            "presence",
            self.channel_name,
        )

    async def receive_json(self, content):
        #  클라이언트에서 heartbeat 메시지를 보내면 last_seen 갱신
        if content.get("type") == "heartbeat":
            mark_user_online(self.user.id)  # TTL 연장
            await self.update_last_seen()

    async def disconnect(self, close_code):
        user = getattr(self, "user", None)
        # 연결 종료 시에도 기록
        if user and user.is_authenticated:
            await self.update_last_seen()

    @database_sync_to_async
    def update_last_seen(self):
        User = get_user_model()
        user = getattr(self, "user", None)
        if user and user.is_authenticated:
            User.objects.filter(id=user.id).update(
                last_seen=timezone.now()
            )
# Redis 헬퍼 함수들
def mark_user_online(user_id):
    redis_client.set(f"user:online:{user_id}", 1, ex=30)

def is_user_online(user_id):
    return redis_client.exists(f"user:online:{user_id}") == 1

