from __future__ import annotations

from typing import Any

import httpx
from pydantic import BaseModel, field_validator

from app.core.config import get_settings

GOOGLE_ADDRESS_VALIDATION_URL = "https://addressvalidation.googleapis.com/v1:validateAddress"
JUNK_ADDRESS_HINTS = {
    "test",
    "home",
    "near bus stand",
    "ana sagar lake",
}


class PickupAddressValidationRequest(BaseModel):
    pickupLocationName: str = ""
    name: str
    phone: str
    email: str
    address1: str
    address2: str = ""
    landmark: str = ""
    city: str
    state: str
    pincode: str
    country: str = "India"
    placeId: str = ""
    formattedAddress: str = ""
    lat: float
    lon: float
    sellerConfirmed: bool

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        stripped = value.strip()
        if not (
            stripped.startswith("+91")
            and len(stripped) == 13
            and stripped[3:].isdigit()
            and stripped[3] in "6789"
        ):
            raise ValueError("Enter a valid +91 mobile number.")
        return stripped

    @field_validator("pincode")
    @classmethod
    def validate_pincode(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) != 6 or not cleaned.isdigit():
            raise ValueError("Enter a valid 6-digit pincode.")
        return cleaned

    @field_validator("address1")
    @classmethod
    def validate_address1(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 15:
            raise ValueError("Pickup address needs house/flat/building and street details.")
        lowered = cleaned.lower()
        if lowered in JUNK_ADDRESS_HINTS:
            raise ValueError("Pickup address needs a real courier-ready street address.")
        return cleaned

    @field_validator("city", "state", "name", "email", "country")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required.")
        return cleaned

    @field_validator("lat", "lon")
    @classmethod
    def validate_finite_coords(cls, value: float) -> float:
        if not isinstance(value, (int, float)) or value != value or value in (
            float("inf"),
            float("-inf"),
        ):
            raise ValueError("Pickup location pin is required.")
        return float(value)

    @field_validator("sellerConfirmed")
    @classmethod
    def validate_confirmation(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("Seller confirmation is required.")
        return value


def _verdict_summary(result: dict[str, Any]) -> tuple[list[str], str]:
    verdict = result.get("verdict") if isinstance(result.get("verdict"), dict) else {}
    address = result.get("address") if isinstance(result.get("address"), dict) else {}
    missing = (
        address.get("missingComponentTypes")
        if isinstance(address.get("missingComponentTypes"), list)
        else []
    )
    unconfirmed = (
        address.get("unconfirmedComponentTypes")
        if isinstance(address.get("unconfirmedComponentTypes"), list)
        else []
    )
    unresolved = (
        address.get("unresolvedTokens")
        if isinstance(address.get("unresolvedTokens"), list)
        else []
    )
    reasons = [str(item) for item in [*missing, *unconfirmed, *unresolved] if str(item).strip()]

    if verdict.get("addressComplete") is True:
        return reasons, "Pickup address is Google-validated and courier-ready."
    if reasons:
        return reasons, "Google needs a more exact pickup address before courier pickup can be enabled."
    return reasons, "Pickup address could not be confirmed yet."


async def validate_pickup_address(payload: PickupAddressValidationRequest) -> dict[str, Any]:
    settings = get_settings()
    if not settings.google_maps_server_api_key:
        raise RuntimeError("Google Address Validation is not configured.")

    google_payload = {
        "address": {
            "regionCode": "IN",
            "languageCode": "en",
            "addressLines": [payload.address1, payload.address2, payload.landmark],
            "locality": payload.city,
            "administrativeArea": payload.state,
            "postalCode": payload.pincode,
        }
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            GOOGLE_ADDRESS_VALIDATION_URL,
            params={"key": settings.google_maps_server_api_key},
            json=google_payload,
        )
        response.raise_for_status()
        data = response.json()

    result = data.get("result") if isinstance(data.get("result"), dict) else {}
    verdict = result.get("verdict") if isinstance(result.get("verdict"), dict) else {}
    geocode = result.get("geocode") if isinstance(result.get("geocode"), dict) else {}
    location = geocode.get("location") if isinstance(geocode.get("location"), dict) else {}
    reason_codes, message = _verdict_summary(result)

    address_complete = verdict.get("addressComplete") is True
    validation_granularity = verdict.get("validationGranularity")
    geocode_granularity = verdict.get("geocodeGranularity")
    formatted_address = (
        result.get("address", {}).get("formattedAddress")
        if isinstance(result.get("address"), dict)
        else None
    )
    normalized_place_id = (
        geocode.get("placeId")
        if isinstance(geocode.get("placeId"), str)
        else payload.placeId or None
    )
    resolved_lat = (
        location.get("latitude")
        if isinstance(location.get("latitude"), (int, float))
        else payload.lat
    )
    resolved_lon = (
        location.get("longitude")
        if isinstance(location.get("longitude"), (int, float))
        else payload.lon
    )

    is_courier_ready = bool(
        address_complete
        and validation_granularity in {"PREMISE", "SUB_PREMISE", "PREMISE_PROXIMITY", "ROUTE"}
        and geocode_granularity in {"PREMISE", "SUB_PREMISE", "ROUTE"}
    )

    return {
        "ok": True,
        "isCourierReady": is_courier_ready,
        "validationLevel": "google_validated" if is_courier_ready else "needs_more_detail",
        "formattedAddress": formatted_address or payload.formattedAddress or None,
        "lat": resolved_lat if isinstance(resolved_lat, (int, float)) else None,
        "lon": resolved_lon if isinstance(resolved_lon, (int, float)) else None,
        "placeId": normalized_place_id,
        "reasonCodes": reason_codes,
        "message": message,
        "googleVerdict": {
            "addressComplete": address_complete,
            "validationGranularity": validation_granularity
            if isinstance(validation_granularity, str)
            else None,
            "geocodeGranularity": geocode_granularity if isinstance(geocode_granularity, str) else None,
        },
    }
