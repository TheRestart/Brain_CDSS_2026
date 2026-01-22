# SSL/TLS 설정 가이드

## 1. Let's Encrypt 무료 인증서 발급 (권장)

### 1.1 Certbot 설치
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot

# CentOS/RHEL
sudo yum install certbot
```

### 1.2 인증서 발급
```bash
# Standalone 모드 (포트 80 사용 가능할 때)
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Webroot 모드 (Nginx 실행 중일 때)
sudo certbot certonly --webroot -w /var/www/html -d your-domain.com
```

### 1.3 인증서 파일 복사
```bash
# Docker 볼륨으로 복사
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/
sudo chmod 644 docker/nginx/ssl/*.pem
```

### 1.4 자동 갱신 설정
```bash
# crontab에 추가
sudo crontab -e

# 매월 1일 새벽 3시에 갱신 시도
0 3 1 * * certbot renew --quiet && docker exec nn-nginx nginx -s reload
```

---

## 2. nginx.conf SSL 활성화

`docker/nginx/nginx.conf` 파일에서 주석 해제:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # ... 나머지 설정
}
```

---

## 3. Self-Signed 인증서 (개발/테스트용)

```bash
# 인증서 생성
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem \
  -subj "/C=KR/ST=Seoul/L=Seoul/O=NeuroNova/CN=localhost"
```

---

## 4. 프론트엔드 환경변수 업데이트

`.env` 파일 수정:
```env
VITE_API_BASE_URL=https://your-domain.com/api
VITE_WS_URL=wss://your-domain.com/ws
```

---

## 5. 검증

```bash
# SSL 인증서 확인
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# SSL Labs 테스트
# https://www.ssllabs.com/ssltest/
```
