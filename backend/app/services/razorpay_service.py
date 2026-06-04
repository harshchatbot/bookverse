from __future__ import annotations

import base64
import hashlib
import hmac
from typing import Any

import httpx

from app.core.config import get_settings

RAZORPAY_BASE_URL = "https://api.razorpay.com/v1"


def estimate_gateway_fee(amount_in_rupees: float) -> int:
    fee = amount_in_rupees * 0.0236
    return int(-(-fee // 1))


def get_razorpay_key_id() -> str:
    key_id = get_settings().razorpay_key_id
    if not key_id:
        raise RuntimeError("RAZORPAY_KEY_ID is not set")
    return key_id


def _get_razorpay_key_secret() -> str:
    key_secret = get_settings().razorpay_key_secret
    if not key_secret:
        raise RuntimeError("RAZORPAY_KEY_SECRET is not set")
    return key_secret


def _auth_header() -> str:
    raw = f"{get_razorpay_key_id()}:{_get_razorpay_key_secret()}".encode("utf-8")
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
    expected = hmac.new(
        _get_razorpay_key_secret().encode("utf-8"),
        f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
