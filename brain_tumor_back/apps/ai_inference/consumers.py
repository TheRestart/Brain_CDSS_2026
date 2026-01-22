import json
from channels.generic.websocket import AsyncWebsocketConsumer


class AIInferenceConsumer(AsyncWebsocketConsumer):
    """AI 추론 결과 WebSocket Consumer"""

    async def connect(self):
        self.group_name = 'ai_inference'

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def ai_inference_result(self, event):
        """추론 결과 전송"""
        await self.send(text_data=json.dumps({
            'type': 'AI_INFERENCE_RESULT',
            'job_id': event.get('job_id'),
            'model_type': event.get('model_type'),
            'status': event.get('status'),
            'result': event.get('result'),
            'error': event.get('error'),
        }))
