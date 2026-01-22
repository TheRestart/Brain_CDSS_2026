# config/routing.py

Django Channels WebSocket 라우팅 설정 파일.

## 개요

이 파일은 WebSocket 연결을 적절한 Consumer로 라우팅하는 URL 패턴을 정의합니다.
`config/asgi.py`에서 `AuthMiddlewareStack`과 함께 사용됩니다.

## WebSocket 엔드포인트

| 경로 | Consumer | 앱 | 용도 |
|------|----------|-----|------|
| `ws/permissions/` | `PermissionConsumer` | authorization | 권한 변경 실시간 알림 |
| `ws/user-permissions/` | `UserPermissionConsumer` | accounts | 사용자별 권한 변경 알림 |
| `ws/presence/` | `PresenceConsumer` | accounts | 사용자 온라인 상태 추적 |
| `ws/ocs/` | `OCSConsumer` | ocs | OCS 데이터 실시간 업데이트 |
| `ws/ai-inference/` | `AIInferenceConsumer` | ai_inference | AI 추론 결과 실시간 수신 |

## 연결 방식

### Frontend (JavaScript)
```javascript
const ws = new WebSocket(`ws://${host}/ws/ai-inference/?token=${accessToken}`);

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'AI_INFERENCE_RESULT') {
        // 추론 결과 처리
    }
};
```

### Backend (Django)
```python
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

channel_layer = get_channel_layer()
async_to_sync(channel_layer.group_send)(
    'ai_inference',  # group name
    {
        'type': 'ai_inference_result',
        'job_id': job_id,
        'status': 'completed',
        'result': result_data,
    }
)
```

## 데이터 흐름

```
┌─────────────┐     POST /api/ai/callback/     ┌─────────────┐
│   FastAPI   │ ─────────────────────────────► │   Django    │
│  (AI 추론)  │                                │  (Backend)  │
└─────────────┘                                └──────┬──────┘
                                                      │
                                               channel_layer
                                               .group_send()
                                                      │
                                                      ▼
                                               ┌──────────────┐
                                               │    Redis     │
                                               │ (Channel Layer)│
                                               └──────┬───────┘
                                                      │
                                                      ▼
                                               ┌──────────────┐
                                               │ AIInference  │
                                               │  Consumer    │
                                               └──────┬───────┘
                                                      │
                                                WebSocket
                                                      │
                                                      ▼
                                               ┌──────────────┐
                                               │   Frontend   │
                                               │   (React)    │
                                               └──────────────┘
```

## 설정 요구사항

### Redis (Channel Layer)
```python
# config/settings.py
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [('redis', 6379)],
        },
    },
}
```

### ASGI 설정
```python
# config/asgi.py
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from config.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
```

## 관련 파일

- `config/asgi.py` - ASGI 애플리케이션 설정
- `apps/ai_inference/consumers.py` - AI 추론 WebSocket Consumer
- `apps/accounts/consumers.py` - 사용자/권한 Consumer
- `apps/ocs/consumers.py` - OCS 데이터 Consumer
