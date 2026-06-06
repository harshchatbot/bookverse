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

When you want the frontend to call FastAPI for migrated endpoints, add this to the frontend env:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=
```

The browser key is only for Google Maps JavaScript + Places Autocomplete. Keep Address Validation on the backend only:

```bash
GOOGLE_MAPS_SERVER_API_KEY=
```

## Protected delivery env

For protected-delivery checkout routes migrated to FastAPI, set:

```bash
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=
SHIPROCKET_TOKEN=
SHIPROCKET_MODE=
SHIPROCKET_AUTO_CREATE_AFTER_PAYMENT=
SHIPROCKET_ALLOW_LIVE_ORDER_CREATION=
```

## Pickup address validation

FastAPI now exposes:

```bash
POST /address/validate-pickup
```

This route requires a Firebase Bearer token and uses `GOOGLE_MAPS_SERVER_API_KEY` server-side. Do not call Google Address Validation directly from the frontend.
