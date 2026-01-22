import httpx
import redis

# Direct test to FastAPI
response = httpx.post(
    "http://localhost:9000/api/v1/mg/inference",
    json={
        "job_id": "test_mg_002",
        "ocs_id": 16,
        "patient_id": "TEST001",
        "csv_content": "gene,value\nGENE1,1.0",
        "callback_url": "http://localhost:8000/api/ai/callback/",
        "mode": "auto",
    },
    timeout=30.0
)
print(f"Response: {response.status_code}")
print(f"Body: {response.json()}")

# Check Redis queues
r = redis.Redis(host="localhost", port=6379, db=2)
print(f"\nmg_queue length after: {r.llen('mg_queue')}")
print(f"m2_queue length after: {r.llen('m2_queue')}")
