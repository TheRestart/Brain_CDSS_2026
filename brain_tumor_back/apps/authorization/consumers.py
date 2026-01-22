import json
from channels.generic.websocket import AsyncWebsocketConsumer

class PermissionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        print("🔥 WebSocket connected")

    async def disconnect(self, close_code):
        print("❌ WebSocket disconnected")

    async def receive(self, text_data):
        data = json.loads(text_data)
        # 권한 변경 이벤트 처리
        await self.send(text_data=json.dumps({
            "type": "PERMISSION_CHANGED",
            "message": "권한이 변경되었습니다."
        }))