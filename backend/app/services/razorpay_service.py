from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings

RAZORPAY_BASE_URL = "https://api.razorpay.com/v1"
logger = logging.getLogger(__name__)
_logged_config_key: str | None = None


@dataclass(frozen=True)
class RazorpayConfig:
    mode: str
    key_id: str
    key_secret: str


def estimate_gateway_fee(amount_in_rupees: float) -> int:
    fee = amount_in_rupees * 0.0236
    return int(-(-fee // 1))


def _razorpay_mode() -> str:
    return "test" if (get_settings().razorpay_mode or "").strip().lower() == "test" else "live"


def _validate_key_prefix(mode: str, key_id: str) -> None:
    expected_prefix = "rzp_test" if mode == "test" else "rzp_live"
    if not key_id.startswith(expected_prefix):
        raise RuntimeError(
            f"Razorpay mode/key mismatch: mode={mode} requires a key starting with {expected_prefix}."
        )


def _mask_key_id(key_id: str) -> str:
    if key_id.startswith("rzp_test"):
        return "rzp_test_xxxxx"
    if key_id.startswith("rzp_live"):
        return "rzp_live_xxxxx"
    return "unknown"


def get_razorpay_config() -> RazorpayConfig:
    global _logged_config_key
    settings = get_settings()
    mode = _razorpay_mode()
    key_id = (
        (settings.razorpay_test_key_id if mode == "test" else settings.razorpay_key_id) or ""
    ).strip()
    key_secret = (
        (settings.razorpay_test_key_secret if mode == "test" else settings.razorpay_key_secret)
        or ""
    ).strip()

    if not key_id or not key_secret:
        raise RuntimeError(
            "RAZORPAY_TEST_KEY_ID / RAZORPAY_TEST_KEY_SECRET are not set"
            if mode == "test"
            else "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set"
        )

    _validate_key_prefix(mode, key_id)
    log_key = f"{mode}:{key_id}"
    if _logged_config_key != log_key:
        logger.info("Razorpay mode=%s activeKey=%s", mode, _mask_key_id(key_id))
        _logged_config_key = log_key

    return RazorpayConfig(mode=mode, key_id=key_id, key_secret=key_secret)


def get_razorpay_key_id() -> str:
    return get_razorpay_config().key_id


def _auth_header() -> str:
    config = get_razorpay_config()
    raw = f"{config.key_id}:{config.key_secret}".encode("utf-8")
    return "Basic " + base64.b64encode(raw).decode("utf-8")


async def create_razorpay_order(input_data: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{RAZORPAY_BASE_URL}/orders",
            json=input_data,
            headers={"Authorization": _auth_header(), "Content-Type": "application/json"},
        )
    if response.status_code >= 400:
        raise RuntimeError(f"Razorpay error ({response.status_code}): {response.text}")
    return response.json()


def verify_razorpay_signature(
    *, razorpay_order_id: str, razorpay_payment_id: str, signature: str
) -> bool:
    config = get_razorpay_config()
    expected = hmac.new(
        config.key_secret.encode("utf-8"),
        f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
