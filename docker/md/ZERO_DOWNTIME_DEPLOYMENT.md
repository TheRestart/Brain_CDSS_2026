# 무중단 배포 가이드 (Zero-Downtime Deployment)

Brain Tumor CDSS 프로젝트의 무중단 배포 설정 및 운영 가이드입니다.

---

## 목차

1. [개요](#1-개요)
2. [방법 1: Blue-Green 배포](#2-방법-1-blue-green-배포)
3. [방법 2: Docker Swarm Rolling Update](#3-방법-2-docker-swarm-rolling-update)
4. [방법 3: Kubernetes (참고)](#4-방법-3-kubernetes-참고)
5. [배포 스크립트](#5-배포-스크립트)

---

## 1. 개요

### 무중단 배포란?
서비스 중단 없이 새로운 버전을 배포하는 방식입니다.

### 배포 방식 비교

| 방식 | 복잡도 | 리소스 사용 | 롤백 속도 | 권장 환경 |
|------|--------|-------------|-----------|-----------|
| Blue-Green | 중간 | 2배 (일시적) | 즉시 | 단일 서버 |
| Docker Swarm | 낮음 | 1.5배 | 빠름 | 소규모 클러스터 |
| Kubernetes | 높음 | 유동적 | 빠름 | 대규모 클러스터 |

---

## 2. 방법 1: Blue-Green 배포

두 개의 동일한 환경(Blue/Green)을 준비하고, 트래픽을 전환하는 방식입니다.

### 2.1 Nginx 설정 변경

`docker/nginx/nginx.conf` 파일의 upstream 설정을 수정합니다:

```nginx
# 기존 설정
upstream django_backend {
    server django:8000;
    keepalive 32;
}

# Blue-Green 배포용 설정으로 변경
upstream django_backend {
    # Blue 환경 (현재 운영)
    server django-blue:8000 weight=1;

    # Green 환경 (새 버전 배포 시 활성화)
    # server django-green:8000 weight=1;

    keepalive 32;
}

upstream fastapi_backend {
    server fastapi-blue:9000 weight=1;
    # server fastapi-green:9000 weight=1;

    keepalive 32;
}
```

### 2.2 Docker Compose 설정

`docker/docker-compose.blue-green.yml` 파일을 새로 생성합니다:

```yaml
# =============================================================
# docker-compose.blue-green.yml - Blue-Green Deployment
# =============================================================

services:
  # --- Nginx (Load Balancer) ---
  nginx:
    image: nginx:alpine
    container_name: nn-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ../brain_tumor_front/dist:/usr/share/nginx/html:ro
      - ./nginx/nginx-blue-green.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - django_static:/app/static:ro
      - django_media:/app/media:ro
    networks:
      - medical-net

  # --- Django Blue (현재 운영) ---
  django-blue:
    build:
      context: ../brain_tumor_back
      dockerfile: Dockerfile
    image: nn-django:blue
    container_name: nn-django-blue
    restart: always
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings
      - DEBUG=False
      - MYSQL_HOST=django-db
      - MYSQL_PORT=3306
      - REDIS_HOST=redis
      - FASTAPI_URL=http://fastapi-blue:9000
    volumes:
      - django_static:/app/static
      - django_media:/app/media
    command: >
      sh -c "python manage.py migrate --noinput &&
             python manage.py collectstatic --noinput &&
             daphne -b 0.0.0.0 -p 8000 config.asgi:application"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health/"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - medical-net

  # --- Django Green (새 버전 배포용) ---
  django-green:
    build:
      context: ../brain_tumor_back
      dockerfile: Dockerfile
    image: nn-django:green
    container_name: nn-django-green
    restart: "no"  # 배포 시에만 시작
    profiles:
      - green  # docker compose --profile green 으로 시작
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings
      - DEBUG=False
      - MYSQL_HOST=django-db
      - MYSQL_PORT=3306
      - REDIS_HOST=redis
      - FASTAPI_URL=http://fastapi-green:9000
    volumes:
      - django_static:/app/static
      - django_media:/app/media
    command: >
      sh -c "python manage.py migrate --noinput &&
             python manage.py collectstatic --noinput &&
             daphne -b 0.0.0.0 -p 8000 config.asgi:application"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health/"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - medical-net

  # --- FastAPI Blue ---
  fastapi-blue:
    build:
      context: ../modAI
      dockerfile: Dockerfile
    image: nn-fastapi:blue
    container_name: nn-fastapi-blue
    restart: always
    environment:
      - DJANGO_URL=http://django-blue:8000
    command: uvicorn main:app --host 0.0.0.0 --port 9000 --workers 2
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - medical-net

  # --- FastAPI Green ---
  fastapi-green:
    build:
      context: ../modAI
      dockerfile: Dockerfile
    image: nn-fastapi:green
    container_name: nn-fastapi-green
    restart: "no"
    profiles:
      - green
    environment:
      - DJANGO_URL=http://django-green:8000
    command: uvicorn main:app --host 0.0.0.0 --port 9000 --workers 2
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - medical-net

  # --- 공통 인프라 (DB, Redis 등) ---
  django-db:
    image: mysql:8.0
    container_name: nn-django-db
    restart: always
    environment:
      - MYSQL_ROOT_PASSWORD=${DJANGO_DB_ROOT_PASS:-root1234}
      - MYSQL_DATABASE=${DJANGO_DB_NAME:-brain_tumor}
    volumes:
      - django_db_data:/var/lib/mysql
    networks:
      - medical-net

  redis:
    image: redis:7-alpine
    container_name: nn-redis
    restart: always
    volumes:
      - redis_data:/data
    networks:
      - medical-net

networks:
  medical-net:
    name: medical-net

volumes:
  django_db_data:
  django_static:
  django_media:
  redis_data:
```

### 2.3 Blue-Green 전용 Nginx 설정

`docker/nginx/nginx-blue-green.conf` 파일을 생성합니다:

```nginx
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Upstream 설정 - 배포 시 주석 전환
    upstream django_backend {
        # ========== 현재 활성 환경 ==========
        # Blue 환경 (주석 해제 = 활성)
        server django-blue:8000;

        # Green 환경 (주석 해제 = 활성)
        # server django-green:8000;
        # ====================================

        keepalive 32;
    }

    upstream fastapi_backend {
        # Blue 환경
        server fastapi-blue:9000;

        # Green 환경
        # server fastapi-green:9000;

        keepalive 32;
    }

    server {
        listen 80;
        server_name localhost;

        root /usr/share/nginx/html;
        index index.html;

        # React SPA
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Django API
        location /api/ {
            proxy_pass http://django_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket
        location /ws/ {
            proxy_pass http://django_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }

        # Health Check
        location /nginx-health {
            access_log off;
            return 200 "healthy\n";
        }
    }
}
```

### 2.4 Blue-Green 배포 절차

```bash
# 1. Green 환경 이미지 빌드
docker compose -f docker-compose.blue-green.yml build django-green fastapi-green

# 2. Green 환경 시작
docker compose -f docker-compose.blue-green.yml --profile green up -d

# 3. Green 환경 Health Check 확인
curl http://localhost:8001/health/  # Green 포트로 직접 확인

# 4. Nginx 설정 변경 (Blue → Green)
# nginx-blue-green.conf에서 주석 전환 후:
docker exec nn-nginx nginx -s reload

# 5. Blue 환경 중지 (선택)
docker stop nn-django-blue nn-fastapi-blue

# 6. 롤백 필요 시
# nginx 설정에서 다시 Blue로 전환
docker exec nn-nginx nginx -s reload
docker start nn-django-blue nn-fastapi-blue
```

---

## 3. 방법 2: Docker Swarm Rolling Update

Docker Swarm은 내장된 Rolling Update 기능을 제공합니다.

### 3.1 사전 준비

```bash
# Docker Swarm 초기화
docker swarm init

# 단일 노드에서도 사용 가능
docker swarm init --advertise-addr 127.0.0.1
```

### 3.2 Swarm용 Docker Compose 설정

`docker/docker-compose.swarm.yml` 파일을 생성합니다:

```yaml
# =============================================================
# docker-compose.swarm.yml - Docker Swarm Deployment
# =============================================================
version: "3.8"

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /path/to/brain_tumor_front/dist:/usr/share/nginx/html:ro
      - /path/to/nginx/nginx-swarm.conf:/etc/nginx/nginx.conf:ro
    deploy:
      replicas: 1
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    networks:
      - medical-net

  django:
    image: nn-django:latest
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings
      - MYSQL_HOST=django-db
      - REDIS_HOST=redis
    deploy:
      replicas: 2  # 2개 인스턴스로 무중단 보장
      update_config:
        parallelism: 1      # 한 번에 1개씩 업데이트
        delay: 30s          # 업데이트 간 대기 시간
        failure_action: rollback
        order: start-first  # 새 컨테이너 먼저 시작
      rollback_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health/"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
    networks:
      - medical-net

  fastapi:
    image: nn-fastapi:latest
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 30s
        failure_action: rollback
        order: start-first
      restart_policy:
        condition: on-failure
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - medical-net

  django-db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=root1234
      - MYSQL_DATABASE=brain_tumor
    volumes:
      - django_db_data:/var/lib/mysql
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
    networks:
      - medical-net

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    deploy:
      replicas: 1
    networks:
      - medical-net

networks:
  medical-net:
    driver: overlay

volumes:
  django_db_data:
  redis_data:
```

### 3.3 Swarm용 Nginx 설정

`docker/nginx/nginx-swarm.conf` 파일을 생성합니다:

```nginx
worker_processes auto;
error_log /var/log/nginx/error.log warn;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Docker Swarm DNS resolver
    resolver 127.0.0.11 valid=10s;

    # Upstream with dynamic resolution
    upstream django_backend {
        # Swarm 내부 DNS가 자동으로 로드밸런싱
        server django:8000 resolve;
        keepalive 32;
    }

    upstream fastapi_backend {
        server fastapi:9000 resolve;
        keepalive 32;
    }

    server {
        listen 80;
        server_name localhost;

        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://django_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

            # 연결 실패 시 다음 서버로
            proxy_next_upstream error timeout http_500 http_502 http_503;
            proxy_next_upstream_tries 2;
        }

        location /ws/ {
            proxy_pass http://django_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        location /nginx-health {
            access_log off;
            return 200 "healthy\n";
        }
    }
}
```

### 3.4 Swarm 배포 및 업데이트 명령어

```bash
# 1. 스택 배포 (최초)
docker stack deploy -c docker-compose.swarm.yml brain-tumor

# 2. 서비스 상태 확인
docker service ls
docker service ps brain-tumor_django

# 3. 이미지 업데이트 (무중단 Rolling Update)
docker service update --image nn-django:v2 brain-tumor_django

# 4. 수동 롤백
docker service rollback brain-tumor_django

# 5. 스케일 조정
docker service scale brain-tumor_django=3

# 6. 로그 확인
docker service logs -f brain-tumor_django

# 7. 스택 제거
docker stack rm brain-tumor
```

### 3.5 Swarm 주요 설정 설명

| 설정 | 설명 |
|------|------|
| `replicas: 2` | 2개의 컨테이너 인스턴스 유지 |
| `parallelism: 1` | 한 번에 1개씩 업데이트 |
| `delay: 30s` | 각 업데이트 사이 30초 대기 |
| `order: start-first` | 새 컨테이너가 healthy 상태가 된 후 기존 컨테이너 종료 |
| `failure_action: rollback` | 업데이트 실패 시 자동 롤백 |

---

## 4. 방법 3: Kubernetes (참고)

대규모 환경에서는 Kubernetes를 권장합니다.

### 4.1 Deployment 설정 예시

```yaml
# kubernetes/django-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: django
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 최대 1개 추가 Pod
      maxUnavailable: 0  # 항상 모든 Pod 유지
  selector:
    matchLabels:
      app: django
  template:
    metadata:
      labels:
        app: django
    spec:
      containers:
      - name: django
        image: nn-django:latest
        ports:
        - containerPort: 8000
        readinessProbe:
          httpGet:
            path: /health/
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health/
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
```

### 4.2 Kubernetes 배포 명령어

```bash
# 배포
kubectl apply -f kubernetes/

# 이미지 업데이트 (Rolling Update 자동)
kubectl set image deployment/django django=nn-django:v2

# 롤백
kubectl rollout undo deployment/django

# 상태 확인
kubectl rollout status deployment/django
```

---

## 5. 배포 스크립트

### 5.1 Blue-Green 배포 스크립트

`docker/scripts/deploy-blue-green.sh`:

```bash
#!/bin/bash
# =============================================================
# Blue-Green Deployment Script
# =============================================================

set -e

COMPOSE_FILE="docker-compose.blue-green.yml"
NGINX_CONF="nginx/nginx-blue-green.conf"

# 현재 활성 환경 확인
get_active_env() {
    if grep -q "server django-blue:8000;" "$NGINX_CONF" | grep -v "#"; then
        echo "blue"
    else
        echo "green"
    fi
}

CURRENT_ENV=$(get_active_env)
if [ "$CURRENT_ENV" = "blue" ]; then
    NEW_ENV="green"
else
    NEW_ENV="blue"
fi

echo "=== Blue-Green Deployment ==="
echo "Current: $CURRENT_ENV"
echo "New: $NEW_ENV"
echo ""

# 1. 새 환경 이미지 빌드
echo "[1/5] Building $NEW_ENV images..."
docker compose -f $COMPOSE_FILE build django-$NEW_ENV fastapi-$NEW_ENV

# 2. 새 환경 시작
echo "[2/5] Starting $NEW_ENV environment..."
docker compose -f $COMPOSE_FILE --profile $NEW_ENV up -d

# 3. Health Check 대기
echo "[3/5] Waiting for health check..."
sleep 30

HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/health/ || echo "000")
if [ "$HEALTH_CHECK" != "200" ]; then
    echo "ERROR: Health check failed for $NEW_ENV environment"
    docker compose -f $COMPOSE_FILE --profile $NEW_ENV down
    exit 1
fi

# 4. Nginx 설정 전환
echo "[4/5] Switching nginx to $NEW_ENV..."
if [ "$NEW_ENV" = "green" ]; then
    sed -i 's/server django-blue:8000;/# server django-blue:8000;/' $NGINX_CONF
    sed -i 's/# server django-green:8000;/server django-green:8000;/' $NGINX_CONF
    sed -i 's/server fastapi-blue:9000;/# server fastapi-blue:9000;/' $NGINX_CONF
    sed -i 's/# server fastapi-green:9000;/server fastapi-green:9000;/' $NGINX_CONF
else
    sed -i 's/# server django-blue:8000;/server django-blue:8000;/' $NGINX_CONF
    sed -i 's/server django-green:8000;/# server django-green:8000;/' $NGINX_CONF
    sed -i 's/# server fastapi-blue:9000;/server fastapi-blue:9000;/' $NGINX_CONF
    sed -i 's/server fastapi-green:9000;/# server fastapi-green:9000;/' $NGINX_CONF
fi

docker exec nn-nginx nginx -s reload

# 5. 이전 환경 정리 (선택)
echo "[5/5] Stopping $CURRENT_ENV environment..."
docker stop nn-django-$CURRENT_ENV nn-fastapi-$CURRENT_ENV || true

echo ""
echo "=== Deployment Complete ==="
echo "Active environment: $NEW_ENV"
```

### 5.2 Swarm 배포 스크립트

`docker/scripts/deploy-swarm.sh`:

```bash
#!/bin/bash
# =============================================================
# Docker Swarm Rolling Update Script
# =============================================================

set -e

SERVICE_NAME="brain-tumor"
IMAGE_TAG=${1:-latest}

echo "=== Swarm Rolling Update ==="
echo "Image tag: $IMAGE_TAG"
echo ""

# 1. 이미지 빌드 및 푸시 (레지스트리 사용 시)
echo "[1/4] Building images..."
docker build -t nn-django:$IMAGE_TAG ../brain_tumor_back/
docker build -t nn-fastapi:$IMAGE_TAG ../modAI/

# 2. 서비스 업데이트
echo "[2/4] Updating Django service..."
docker service update \
    --image nn-django:$IMAGE_TAG \
    --update-parallelism 1 \
    --update-delay 30s \
    --update-order start-first \
    ${SERVICE_NAME}_django

echo "[3/4] Updating FastAPI service..."
docker service update \
    --image nn-fastapi:$IMAGE_TAG \
    --update-parallelism 1 \
    --update-delay 30s \
    --update-order start-first \
    ${SERVICE_NAME}_fastapi

# 3. 상태 확인
echo "[4/4] Checking deployment status..."
docker service ps ${SERVICE_NAME}_django
docker service ps ${SERVICE_NAME}_fastapi

echo ""
echo "=== Rolling Update Complete ==="
```

### 5.3 스크립트 실행 권한 부여

```bash
chmod +x docker/scripts/deploy-blue-green.sh
chmod +x docker/scripts/deploy-swarm.sh
```

---

## 체크리스트

### 배포 전 확인사항

- [ ] Health Check 엔드포인트 구현 (`/health/`)
- [ ] 데이터베이스 마이그레이션 호환성 확인
- [ ] 환경 변수 설정 확인
- [ ] 로그 모니터링 준비

### 배포 후 확인사항

- [ ] 서비스 정상 응답 확인
- [ ] 에러 로그 확인
- [ ] 성능 모니터링
- [ ] 롤백 절차 숙지

---

## 참고 자료

- [Docker Swarm Documentation](https://docs.docker.com/engine/swarm/)
- [Nginx Load Balancing](https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/)
- [Blue-Green Deployment Pattern](https://martinfowler.com/bliki/BlueGreenDeployment.html)
