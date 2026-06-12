from __future__ import annotations

import time
from typing import Any

import httpx

from app.core.config import get_settings

SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external"


class ShiprocketError(RuntimeError):
    pass


_cached_token: dict[str, Any] | None = None


def _shiprocket_mode() -> str:
    return (get_settings().shiprocket_mode or "").strip().lower()


def is_shiprocket_auto_fulfillment_enabled() -> bool:
    return get_settings().shiprocket_auto_create_after_payment == "true"


def is_live_shiprocket_order_creation_allowed() -> bool:
    return get_settings().shiprocket_allow_live_order_creation == "true"


def should_create_live_shiprocket_order() -> bool:
    return (
        (get_settings().razorpay_mode or "").strip().lower() != "test"
        and
        _shiprocket_mode() == "live"
        and is_shiprocket_auto_fulfillment_enabled()
        and is_live_shiprocket_order_creation_allowed()
    )


async def _get_shiprocket_token() -> str:
    global _cached_token
    if _cached_token and _cached_token["expires_at"] > time.time() + 60:
        return str(_cached_token["token"])

    settings = get_settings()
    if settings.shiprocket_token:
        return settings.shiprocket_token
    if not settings.shiprocket_email or not settings.shiprocket_password:
        raise ShiprocketError("SHIPROCKET_EMAIL/PASSWORD not set")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{SHIPROCKET_BASE_URL}/auth/login",
            json={
                "email": settings.shiprocket_email,
                "password": settings.shiprocket_password,
            },
        )
    if response.status_code >= 400:
        raise ShiprocketError(f"Shiprocket auth failed ({response.status_code}): {response.text}")
    data = response.json()
    _cached_token = {
        "token": data["token"],
        "expires_at": time.time() + 9 * 24 * 60 * 60,
    }
    return str(data["token"])


async def _sr_fetch(path: str, *, method: str = "GET", json: Any = None) -> dict[str, Any]:
    token = await _get_shiprocket_token()
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.request(
            method,
            f"{SHIPROCKET_BASE_URL}{path}",
            json=json,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
    if response.status_code >= 400:
        raise ShiprocketError(f"Shiprocket {path} failed ({response.status_code}): {response.text}")
    return response.json()


async def check_serviceability(
    *, pickup_pincode: str, delivery_pincode: str, weight_kg: float, declared_value: int
) -> dict[str, Any]:
    params = httpx.QueryParams(
        {
            "pickup_postcode": pickup_pincode,
            "delivery_postcode": delivery_pincode,
            "weight": str(weight_kg),
            "cod": "0",
            "declared_value": str(declared_value),
        }
    )
    data = await _sr_fetch(f"/courier/serviceability/?{params}")
    couriers = (data.get("data") or {}).get("available_courier_companies") or []
    if not couriers:
        return {"available": False, "rate": 0, "courierId": 0, "courierName": "", "raw": data}
    cheapest = min(couriers, key=lambda entry: entry.get("rate", 0))
    return {
        "available": True,
        "rate": int(-(-float(cheapest.get("rate", 0)) // 1)),
        "courierId": int(cheapest.get("courier_company_id", 0)),
        "courierName": str(cheapest.get("courier_name", "")),
        "raw": data,
    }


async def create_shiprocket_order(payload: dict[str, Any]) -> dict[str, Any]:
    data = await _sr_fetch("/orders/create/adhoc", method="POST", json=payload)
    return {
        "shiprocketOrderId": data["order_id"],
        "shipmentId": data["shipment_id"],
        "status": data.get("status", ""),
        "raw": data,
    }


async def assign_awb(*, shipment_id: int, courier_id: int | None) -> dict[str, Any]:
    body: dict[str, Any] = {"shipment_id": shipment_id}
    if courier_id:
        body["courier_id"] = courier_id
    data = await _sr_fetch("/courier/assign/awb", method="POST", json=body)
    inner = ((data.get("response") or {}).get("data") or {})
    awb = inner.get("awb_code")
    if not awb:
        raise ShiprocketError(f"Shiprocket AWB assignment returned no awb: {data}")
    return {
        "awb": str(awb),
        "courierName": str(inner.get("courier_name", "")),
        "raw": data,
    }


async def generate_pickup(shipment_id: int) -> dict[str, Any]:
    data = await _sr_fetch(
        "/courier/generate/pickup", method="POST", json={"shipment_id": [shipment_id]}
    )
    response = data.get("response") or {}
    token_number = response.get("pickup_token_number")
    return {
        "scheduledDate": response.get("pickup_scheduled_date"),
        "pickupTokenNumber": str(token_number) if token_number is not None else None,
        "raw": data,
    }
