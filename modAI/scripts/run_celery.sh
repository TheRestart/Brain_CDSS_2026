#!/bin/bash
# Celery Worker Start Script for Linux/Ubuntu/GCP

# Change to modAI directory
cd "$(dirname "$0")/.."

echo "========================================"
echo "Starting Celery Worker (Linux/Ubuntu)"
echo "========================================"
echo "Working directory: $(pwd)"
echo ""

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "ERROR: Redis is not running!"
    echo "Start Redis with: sudo systemctl start redis"
    exit 1
fi

echo "Redis: OK"
echo ""

# Start Celery worker with prefork pool (default for Linux)
celery -A celery_app worker \
    --loglevel=info \
    --concurrency=2 \
    --pool=prefork
