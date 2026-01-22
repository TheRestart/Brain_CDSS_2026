# """
# ASGI config for config project.

# It exposes the ASGI callable as a module-level variable named ``application``.

# For more information on this file, see
# https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
# """
# ASGI 설정

import os
import django
from django.core.asgi import get_asgi_application # HTTP + WebSocket + 기타 비동기 프로토콜 지원
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()  # 앱 레지스트리 초기화

from apps.common.middleware import JwtAuthMiddleware
from config.routing import websocket_urlpatterns

# ASGI(Asynchronous Server Gateway Interface)용 진입점
django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app, 
    "websocket": JwtAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
})
