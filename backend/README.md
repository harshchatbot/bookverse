# BookVerse FastAPI Backend

## Local setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Health check

```bash
curl http://localhost:8000/health
```

## Auth test

```bash
curl -H "Authorization: Bearer <firebase-id-token>" http://localhost:8000/auth/me
```

## Frontend opt-in for migrated endpoints

When you want the existing TanStack frontend to call FastAPI for migrated endpoints, add this to the frontend env:

```bash
VITE_API_BASE_URL=http://localhost:8000
```
