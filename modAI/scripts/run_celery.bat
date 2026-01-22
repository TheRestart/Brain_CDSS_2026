@echo off
REM Celery Worker Start Script for Windows

cd /d "%~dp0\.."

echo ========================================
echo Starting Celery Worker (Windows)
echo ========================================
echo Working directory: %CD%
echo.

REM Windows requires --pool=solo or --pool=threads
REM prefork doesn't work properly on Windows
celery -A celery_app worker --loglevel=info --pool=solo
