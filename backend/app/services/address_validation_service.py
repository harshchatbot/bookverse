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
WEAK_TOKENS = {"test", "home", "near", "abc"}
GOOGLE_VALIDATED_LEVEL = "google_validated"
GOOGLE_GEO_CONFIRMED_LEVEL = "google_geo_confirmed"
NEEDS_MORE_DETAIL_LEVEL = "needs_more_detail"


class PickupAddressValidationRequest(BaseModel):
    pickupLocationName: str = ""
    name: str
    phone: str
    email: str
    houseOrFlat: str
    buildingOrSociety: str = ""
    streetOrRoad: str = ""
    areaOrLocality: str
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

    @field_validator("houseOrFlat", "areaOrLocality", "landmark")
    @classmethod
    def validate_required_address_parts(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required.")
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


class DeliveryAddressValidationRequest(BaseModel):
    name: str
    phone: str
    email: str
    houseOrFlat: str
    buildingOrSociety: str = ""
    streetOrRoad: str = ""
    areaOrLocality: str
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
    buyerConfirmed: bool

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        return PickupAddressValidationRequest.validate_phone(value)

    @field_validator("pincode")
    @classmethod
    def validate_pincode(cls, value: str) -> str:
        return PickupAddressValidationRequest.validate_pincode(value)

    @field_validator("houseOrFlat", "areaOrLocality", "landmark")
    @classmethod
    def validate_required_address_parts(cls, value: str) -> str:
        return PickupAddressValidationRequest.validate_required_address_parts(value)

    @field_validator("city", "state", "name", "email", "country")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        return PickupAddressValidationRequest.validate_non_empty(value)

    @field_validator("lat", "lon")
    @classmethod
    def validate_finite_coords(cls, value: float) -> float:
        return PickupAddressValidationRequest.validate_finite_coords(value)

    @field_validator("buyerConfirmed")
    @classmethod
    def validate_confirmation(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("Buyer confirmation is required.")
        return value


def _verdict_summary(result: dict[str, Any], *, mode: str) -> tuple[list[str], str]:
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
        return reasons, (
            "Pickup address is Google-validated and courier-ready."
            if mode == "pickup"
            else "Delivery address is Google-validated and ready for courier delivery."
        )
    if reasons:
        return reasons, (
            "Google needs a more exact pickup address before courier pickup can be enabled."
            if mode == "pickup"
            else "Google needs a more exact delivery address before protected delivery can continue."
        )
    return reasons, (
        "Pickup address could not be confirmed yet."
        if mode == "pickup"
        else "Delivery address could not be confirmed yet."
    )


def _combined_address_for_scoring(payload: Any) -> str:
    return " ".join(
        part.strip()
        for part in [
            payload.houseOrFlat,
            payload.buildingOrSociety,
            payload.streetOrRoad,
            payload.areaOrLocality,
            payload.landmark,
            payload.address1,
            payload.address2,
        ]
        if part and part.strip()
    ).lower()


def _is_vague_only(value: str) -> bool:
    cleaned = value.strip().lower()
    return cleaned in JUNK_ADDRESS_HINTS or cleaned in {"near bus stand", "near anasagar lake"}


def _validate_structured_precheck(payload: Any, *, mode: str) -> None:
    house = payload.houseOrFlat.strip().lower()
    locality = payload.areaOrLocality.strip().lower()
    if house in WEAK_TOKENS or len(house) < 3:
        raise ValueError(
            "House / Flat / Building No. needs a real pickup detail."
            if mode == "pickup"
            else "House / Flat / Building No. needs a real delivery detail."
        )
    if _is_vague_only(locality):
        raise ValueError(
            "Area / Locality cannot be the only pickup detail."
            if mode == "pickup"
            else "Area / Locality cannot be the only delivery detail."
        )
    combined = _combined_address_for_scoring(payload)
    if payload.areaOrLocality.strip().lower() == combined.strip():
        raise ValueError(
            "Pickup address needs house or flat details, not only locality."
            if mode == "pickup"
            else "Delivery address needs house or flat details, not only locality."
        )


def _structured_address_score(payload: Any) -> int:
    score = 0
    if len(payload.houseOrFlat.strip()) >= 3 and payload.houseOrFlat.strip().lower() not in WEAK_TOKENS:
        score += 30
    if len(payload.areaOrLocality.strip()) >= 3 and not _is_vague_only(payload.areaOrLocality):
        score += 20
    if len(payload.landmark.strip()) >= 3 and not _is_vague_only(payload.landmark):
        score += 15
    if len(payload.buildingOrSociety.strip()) >= 3:
        score += 10
    if len(payload.streetOrRoad.strip()) >= 3:
        score += 10
    if len(payload.city.strip()) >= 2:
        score += 5
    if len(payload.state.strip()) >= 2:
        score += 5
    if len(payload.pincode.strip()) == 6:
        score += 5
    return score


async def _validate_address(
    payload: Any,
    *,
    mode: str,
    ready_key: str,
    confirmed_attr: str,
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.google_maps_server_api_key:
        raise RuntimeError("Google Address Validation is not configured.")

    _validate_structured_precheck(payload, mode=mode)

    google_payload = {
        "address": {
            "regionCode": "IN",
            "languageCode": "en",
            "addressLines": [
                payload.houseOrFlat,
                payload.buildingOrSociety,
                payload.streetOrRoad,
                payload.areaOrLocality,
                payload.address1,
                payload.address2,
                payload.landmark,
            ],
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
    reason_codes, message = _verdict_summary(result, mode=mode)

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

    is_google_validated = bool(
        address_complete
        and validation_granularity in {"PREMISE", "SUB_PREMISE", "PREMISE_PROXIMITY", "ROUTE"}
        and geocode_granularity in {"PREMISE", "SUB_PREMISE", "ROUTE"}
    )
    structured_score = _structured_address_score(payload)
    has_usable_geocode = bool(
        normalized_place_id
        and isinstance(resolved_lat, (int, float))
        and isinstance(resolved_lon, (int, float))
        and (formatted_address or payload.formattedAddress)
    )
    is_google_geo_confirmed = bool(
        not is_google_validated
        and has_usable_geocode
        and structured_score >= 80
        and getattr(payload, confirmed_attr) is True
    )
    is_courier_ready = is_google_validated or is_google_geo_confirmed
    validation_level = (
        GOOGLE_VALIDATED_LEVEL
        if is_google_validated
        else GOOGLE_GEO_CONFIRMED_LEVEL
        if is_google_geo_confirmed
        else NEEDS_MORE_DETAIL_LEVEL
    )
    if is_google_geo_confirmed:
        reason_codes = [
            *reason_codes,
            "GOOGLE_ADDRESS_INCOMPLETE_BUT_PIN_CONFIRMED",
            "STRUCTURED_ADDRESS_COMPLETE",
            "MAP_PIN_CONFIRMED",
        ]
        message = (
            "Google could not fully verify the house number, but your map pin and pickup details "
            "look complete. We will use this seller-confirmed pickup location for courier collection."
            if mode == "pickup"
            else "Google could not fully verify the house number, but your map pin and delivery details "
            "look complete. We will use this buyer-confirmed delivery location for courier delivery."
        )

    return {
        "ok": True,
        ready_key: is_courier_ready,
        "validationLevel": validation_level,
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


async def validate_pickup_address(payload: PickupAddressValidationRequest) -> dict[str, Any]:
    return await _validate_address(
        payload,
        mode="pickup",
        ready_key="isCourierReady",
        confirmed_attr="sellerConfirmed",
    )


async def validate_delivery_address(payload: DeliveryAddressValidationRequest) -> dict[str, Any]:
    return await _validate_address(
        payload,
        mode="delivery",
        ready_key="isDeliveryReady",
        confirmed_attr="buyerConfirmed",
    )
