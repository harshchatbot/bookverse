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

Response:

```json
{
  "ok": true,
  "service": "bookverse-api",
  "timestamp": "2026-06-12T12:00:00+00:00"
}
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
RAZORPAY_MODE=live
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_TEST_KEY_ID=
RAZORPAY_TEST_KEY_SECRET=
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=
SHIPROCKET_TOKEN=
SHIPROCKET_MODE=mock
SHIPROCKET_AUTO_CREATE_AFTER_PAYMENT=
SHIPROCKET_ALLOW_LIVE_ORDER_CREATION=
```

## Razorpay mode switching

BookVerse now switches Razorpay mode with two envs:

- frontend/browser: `NEXT_PUBLIC_RAZORPAY_MODE`
- server/API: `RAZORPAY_MODE`

They should always match.

### Switch back to live mode

Set:

```bash
NEXT_PUBLIC_RAZORPAY_MODE=live
RAZORPAY_MODE=live
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=live_secret_xxxxx
```

Notes:

- live mode uses the existing live keys above
- `RAZORPAY_MODE=live` is also the default if the variable is missing
- after changing any `NEXT_PUBLIC_*` variable, redeploy the frontend because those are build-time variables

### Switch to test mode again later

Set:

```bash
NEXT_PUBLIC_RAZORPAY_MODE=test
RAZORPAY_MODE=test
NEXT_PUBLIC_RAZORPAY_TEST_KEY_ID=rzp_test_xxxxx
RAZORPAY_TEST_KEY_ID=rzp_test_xxxxx
RAZORPAY_TEST_KEY_SECRET=test_secret_xxxxx
```

Recommended while testing:

```bash
SHIPROCKET_MODE=mock
SHIPROCKET_AUTO_CREATE_AFTER_PAYMENT=false
SHIPROCKET_ALLOW_LIVE_ORDER_CREATION=false
```

Mode rules:

- `NEXT_PUBLIC_RAZORPAY_MODE=test` uses `NEXT_PUBLIC_RAZORPAY_TEST_KEY_ID`
- `NEXT_PUBLIC_RAZORPAY_MODE=live` (or unset) uses `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_MODE=test` uses `RAZORPAY_TEST_KEY_ID` + `RAZORPAY_TEST_KEY_SECRET`
- `RAZORPAY_MODE=live` (or unset) uses existing `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`
- Shiprocket should stay `mock` while Razorpay test payments are being debugged

## Pickup address validation

FastAPI now exposes:

```bash
POST /address/validate-pickup
```

This route requires a Firebase Bearer token and uses `GOOGLE_MAPS_SERVER_API_KEY` server-side. Do not call Google Address Validation directly from the frontend.
