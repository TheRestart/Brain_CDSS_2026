# 설치 순서:
# conda 외 일반 환경에서
#   1. python install_pytorch.py
#   2. pip install -r requirements.txt
#   3. celery -A celery_app worker --loglevel=info --pool=solo
#   4. uvicorn main:app --reload --host 127.0.0.1 --port 9000


Celery 실행 명령어
Windows (PowerShell / CMD)
celery -A celery_app worker --loglevel=info --pool=solo
• 	 →  파일 안의  객체를 사용
• 	 → 워커 프로세스를 실행
• 	 → 로그 레벨 설정
• 	 → Windows에서는 멀티프로세싱 풀 대신  풀을 써야 안정적으로 동작합니다
Linux / Mac
celery -A celery_app worker --loglevel=info

🔹 추가 실행 옵션
• 	특정 큐만 실행하기
예: 만 처리하고 싶을 때:
celery -A celery_app worker --loglevel=info --pool=solo -Q m1_queue
• 	비트(beat) 스케줄러 실행 (주기적 작업):
celery -A celery_app beat --loglevel=info
• 	워커 + 비트 동시에 실행:
celery -A celery_app worker -B --loglevel=info --pool=solo

📌 정리
• 	Celery 워커 →
celery -A celery_app worker --loglevel=info --pool=solo
• 	FastAPI 서버 →
uvicorn main:app --reload --host 127.0.0.1 --port 9000

이렇게 하면 웹 서버와 비동기 작업 큐를 각각 실행할 수 있습니다 

# 에러 발생시 로그 확인
uvicorn main:app --reload --host 127.0.0.1 --port 9000 --log-level debug