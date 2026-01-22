#!/bin/bash
# =============================================================
# start.sh - 원클릭 시작 스크립트
# =============================================================
# 사용법: ./start.sh
#
# 기능:
#   1. setup.py 실행 (GPU 자동 감지 및 docker-compose 설정)
#   2. Docker 이미지 빌드
#   3. 전체 서비스 시작
# =============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  Brain Tumor CDSS - Docker 시작"
echo "=========================================="

# 1단계: setup.py 실행 (GPU 감지 및 설정)
echo ""
echo "[1/3] 환경 설정 중 (GPU 감지)..."
python3 setup.py
if [ $? -ne 0 ]; then
    echo "환경 설정 실패. 종료합니다."
    exit 1
fi

# 2단계: fastapi, django 이미지 빌드
echo ""
echo "[2/3] 이미지 빌드 중..."
docker compose -f docker-compose.unified.yml build fastapi django

# 3단계: 전체 서비스 시작
echo ""
echo "[3/3] 서비스 시작 중..."
docker compose -f docker-compose.unified.yml up -d

echo ""
echo "=========================================="
echo "  완료! 서비스 상태 확인:"
echo "  docker compose -f docker-compose.unified.yml ps"
echo "=========================================="
