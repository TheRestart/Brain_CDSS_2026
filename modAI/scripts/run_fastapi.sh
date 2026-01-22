#!/bin/bash
# FastAPI Server Start Script for Linux/Ubuntu/GCP

# Change to modAI directory
cd "$(dirname "$0")/.."

echo "========================================"
echo "Starting FastAPI modAI Server (Linux)"
echo "========================================"
echo "Working directory: $(pwd)"
echo ""

# Default values
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-9000}

echo "Host: $HOST"
echo "Port: $PORT"
echo ""

# Start FastAPI with uvicorn
uvicorn main:app --host $HOST --port $PORT --reload
