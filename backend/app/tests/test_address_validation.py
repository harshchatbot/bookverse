import asyncio

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import address as address_router
from app.services import address_validation_service

client = TestClient(app)


def _fake_user() -> dict[str, str]:
    return {"uid": "user-123", "email": "user@example.com", "decoded": {"uid": "user-123"}}


def _valid_payload() -> dict:
    return {
        "pickupLocationName": "Home",
        "name": "Seller Pickup",
        "phone": "+919999999999",
        "email": "pickup@example.com",
        "houseOrFlat": "H.No 10",
        "buildingOrSociety": "Lake View Apartments",
        "streetOrRoad": "Ana Sagar Link Road",
        "areaOrLocality": "Anand Nagar",
        "address1": "H.No 10, Lake View Apartments, Ana Sagar Link Road, Anand Nagar",
        "address2": "Near Anasagar Lake",
        "landmark": "Near Anasagar Lake",
        "city": "Ajmer",
        "state": "Rajasthan",
        "pincode": "305001",
        "country": "India",
        "placeId": "test-place-id",
        "formattedAddress": "H.No 10, Lake View Apartments, Ana Sagar Link Road, Anand Nagar, Ajmer, Rajasthan 305001, India",
        "lat": 26.4499,
        "lon": 74.6399,
        "sellerConfirmed": True,
    }


class _FakeHttpResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class _FakeAsyncClient:
    def __init__(self, payload: dict):
        self.payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, *args, **kwargs):
        return _FakeHttpResponse(self.payload)


def test_validate_pickup_requires_auth() -> None:
    response = client.post("/address/validate-pickup", json=_valid_payload())
    assert response.status_code == 401


def _valid_delivery_payload() -> dict:
    payload = _valid_payload()
    payload.pop("pickupLocationName", None)
    payload.pop("sellerConfirmed", None)
    payload["buyerConfirmed"] = True
    return payload


def test_validate_delivery_requires_auth() -> None:
    response = client.post("/address/validate-delivery", json=_valid_delivery_payload())
    assert response.status_code == 401


def test_validate_pickup_rejects_locality_only_before_google_call(monkeypatch) -> None:
    app.dependency_overrides[address_router.get_current_user] = _fake_user

    called = False

    async def _fake_validate(_: object) -> dict:
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr(address_router, "validate_pickup_address", _fake_validate)
    payload = _valid_payload()
    payload["houseOrFlat"] = ""
    payload["buildingOrSociety"] = ""
    payload["streetOrRoad"] = ""
    payload["areaOrLocality"] = "Anand Nagar"
    payload["address1"] = "Anand Nagar"
    payload["address2"] = ""
    payload["landmark"] = "Near Anasagar Lake"
    response = client.post(
        "/address/validate-pickup",
        headers={"Authorization": "Bearer test"},
        json=payload,
    )
    assert response.status_code == 422
    assert called is False
    app.dependency_overrides.clear()


def test_validate_pickup_rejects_landmark_only_before_google_call(monkeypatch) -> None:
    app.dependency_overrides[address_router.get_current_user] = _fake_user
    called = False

    async def _fake_validate(_: object) -> dict:
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr(address_router, "validate_pickup_address", _fake_validate)
    payload = _valid_payload()
    payload["houseOrFlat"] = ""
    payload["areaOrLocality"] = ""
    payload["streetOrRoad"] = ""
    payload["buildingOrSociety"] = ""
    payload["address1"] = ""
    payload["address2"] = ""
    payload["landmark"] = "Ana sagar lake"
    response = client.post(
        "/address/validate-pickup",
        headers={"Authorization": "Bearer test"},
        json=payload,
    )
    assert response.status_code == 422
    assert called is False
    app.dependency_overrides.clear()


def test_validate_pickup_accepts_structured_indian_address(monkeypatch) -> None:
    app.dependency_overrides[address_router.get_current_user] = _fake_user

    async def _fake_validate(_: object) -> dict:
        return {
            "ok": True,
            "isCourierReady": True,
            "validationLevel": "google_validated",
            "formattedAddress": "Validated address",
            "lat": 26.4499,
            "lon": 74.6399,
            "placeId": "test-place-id",
            "reasonCodes": [],
            "message": "Pickup address is Google-validated and courier-ready.",
            "googleVerdict": {
                "addressComplete": True,
                "validationGranularity": "PREMISE",
                "geocodeGranularity": "PREMISE",
            },
        }

    monkeypatch.setattr(address_router, "validate_pickup_address", _fake_validate)
    payload = _valid_payload()
    payload["buildingOrSociety"] = ""
    payload["streetOrRoad"] = ""
    payload["address1"] = "H.No 10, Anand Nagar"
    payload["address2"] = "Near Anasagar lake"
    response = client.post(
        "/address/validate-pickup",
        headers={"Authorization": "Bearer test"},
        json=payload,
    )
    assert response.status_code == 200
    assert response.json()["validationLevel"] == "google_validated"
    app.dependency_overrides.clear()


def test_validate_pickup_missing_google_key_returns_503(monkeypatch) -> None:
    app.dependency_overrides[address_router.get_current_user] = _fake_user

    async def _raise_runtime(_: object) -> dict:
        raise RuntimeError("Google Address Validation is not configured.")

    monkeypatch.setattr(address_router, "validate_pickup_address", _raise_runtime)
    response = client.post(
        "/address/validate-pickup",
        headers={"Authorization": "Bearer test"},
        json=_valid_payload(),
    )
    assert response.status_code == 503
    app.dependency_overrides.clear()


def test_validate_pickup_google_complete_response(monkeypatch) -> None:
    app.dependency_overrides[address_router.get_current_user] = _fake_user

    async def _fake_validate(_: object) -> dict:
        return {
            "ok": True,
            "isCourierReady": True,
            "validationLevel": "google_validated",
            "formattedAddress": "Validated address",
            "lat": 18.52,
            "lon": 73.85,
            "placeId": "test-place-id",
            "reasonCodes": [],
            "message": "Pickup address is Google-validated and courier-ready.",
            "googleVerdict": {
                "addressComplete": True,
                "validationGranularity": "PREMISE",
                "geocodeGranularity": "PREMISE",
            },
        }

    monkeypatch.setattr(address_router, "validate_pickup_address", _fake_validate)
    response = client.post(
        "/address/validate-pickup",
        headers={"Authorization": "Bearer test"},
        json=_valid_payload(),
    )
    assert response.status_code == 200
    assert response.json()["validationLevel"] == "google_validated"
    app.dependency_overrides.clear()


def test_validate_pickup_google_incomplete_response(monkeypatch) -> None:
    app.dependency_overrides[address_router.get_current_user] = _fake_user

    async def _fake_validate(_: object) -> dict:
        return {
            "ok": True,
            "isCourierReady": False,
            "validationLevel": "needs_more_detail",
            "formattedAddress": None,
            "lat": 18.52,
            "lon": 73.85,
            "placeId": "test-place-id",
            "reasonCodes": ["route"],
            "message": "Google needs a more exact pickup address before courier pickup can be enabled.",
            "googleVerdict": {
                "addressComplete": False,
                "validationGranularity": "ROUTE",
                "geocodeGranularity": "ROUTE",
            },
        }

    monkeypatch.setattr(address_router, "validate_pickup_address", _fake_validate)
    response = client.post(
        "/address/validate-pickup",
        headers={"Authorization": "Bearer test"},
        json=_valid_payload(),
    )
    assert response.status_code == 200
    assert response.json()["validationLevel"] == "needs_more_detail"
    app.dependency_overrides.clear()


def test_validate_pickup_google_other_but_strong_structured_address(monkeypatch) -> None:
    app.dependency_overrides[address_router.get_current_user] = _fake_user

    async def _fake_validate(_: object) -> dict:
        return {
            "ok": True,
            "isCourierReady": True,
            "validationLevel": "google_geo_confirmed",
            "formattedAddress": "Validated address",
            "lat": 26.4499,
            "lon": 74.6399,
            "placeId": "test-place-id",
            "reasonCodes": [
                "GOOGLE_ADDRESS_INCOMPLETE_BUT_PIN_CONFIRMED",
                "STRUCTURED_ADDRESS_COMPLETE",
                "MAP_PIN_CONFIRMED",
            ],
            "message": "Google could not fully verify the house number, but your map pin and pickup details look complete. We will use this seller-confirmed pickup location for courier collection.",
            "googleVerdict": {
                "addressComplete": False,
                "validationGranularity": "OTHER",
                "geocodeGranularity": "OTHER",
            },
        }

    monkeypatch.setattr(address_router, "validate_pickup_address", _fake_validate)
    response = client.post(
        "/address/validate-pickup",
        headers={"Authorization": "Bearer test"},
        json=_valid_payload(),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["validationLevel"] == "google_geo_confirmed"
    assert body["isCourierReady"] is True
    app.dependency_overrides.clear()


def test_validate_pickup_google_other_missing_house_number_stays_needs_more_detail(monkeypatch) -> None:
    app.dependency_overrides[address_router.get_current_user] = _fake_user

    async def _fake_validate(_: object) -> dict:
        return {
            "ok": True,
            "isCourierReady": False,
            "validationLevel": "needs_more_detail",
            "formattedAddress": "Validated address",
            "lat": 26.4499,
            "lon": 74.6399,
            "placeId": "test-place-id",
            "reasonCodes": ["houseOrFlat"],
            "message": "Google needs a more exact pickup address before courier pickup can be enabled.",
            "googleVerdict": {
                "addressComplete": False,
                "validationGranularity": "OTHER",
                "geocodeGranularity": "OTHER",
            },
        }

    monkeypatch.setattr(address_router, "validate_pickup_address", _fake_validate)
    payload = _valid_payload()
    payload["houseOrFlat"] = ""
    payload["address1"] = "Anand Nagar"
    response = client.post(
        "/address/validate-pickup",
        headers={"Authorization": "Bearer test"},
        json=payload,
    )
    assert response.status_code == 422
    app.dependency_overrides.clear()


def test_validate_delivery_google_other_but_strong_structured_address(monkeypatch) -> None:
    app.dependency_overrides[address_router.get_current_user] = _fake_user

    async def _fake_validate(_: object) -> dict:
        return {
            "ok": True,
            "isDeliveryReady": True,
            "validationLevel": "google_geo_confirmed",
            "formattedAddress": "Validated delivery address",
            "lat": 26.4499,
            "lon": 74.6399,
            "placeId": "delivery-place-id",
            "reasonCodes": [
                "GOOGLE_ADDRESS_INCOMPLETE_BUT_PIN_CONFIRMED",
                "STRUCTURED_ADDRESS_COMPLETE",
                "MAP_PIN_CONFIRMED",
            ],
            "message": "Google could not fully verify the house number, but your map pin and delivery details look complete. We will use this buyer-confirmed delivery location for courier delivery.",
            "googleVerdict": {
                "addressComplete": False,
                "validationGranularity": "OTHER",
                "geocodeGranularity": "OTHER",
            },
        }

    monkeypatch.setattr(address_router, "validate_delivery_address", _fake_validate)
    response = client.post(
        "/address/validate-delivery",
        headers={"Authorization": "Bearer test"},
        json=_valid_delivery_payload(),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["validationLevel"] == "google_geo_confirmed"
    assert body["isDeliveryReady"] is True
    app.dependency_overrides.clear()


def test_validate_delivery_rejects_missing_house_number(monkeypatch) -> None:
    app.dependency_overrides[address_router.get_current_user] = _fake_user
    called = False

    async def _fake_validate(_: object) -> dict:
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr(address_router, "validate_delivery_address", _fake_validate)
    payload = _valid_delivery_payload()
    payload["houseOrFlat"] = ""
    payload["address1"] = "Anand Nagar"
    response = client.post(
        "/address/validate-delivery",
        headers={"Authorization": "Bearer test"},
        json=payload,
    )
    assert response.status_code == 422
    assert called is False
    app.dependency_overrides.clear()


def test_service_returns_google_geo_confirmed_for_strong_structured_address(monkeypatch) -> None:
    payload = address_validation_service.PickupAddressValidationRequest(**_valid_payload())

    class _Settings:
        google_maps_server_api_key = "test-key"

    monkeypatch.setattr(address_validation_service, "get_settings", lambda: _Settings())
    monkeypatch.setattr(
        address_validation_service.httpx,
        "AsyncClient",
        lambda **kwargs: _FakeAsyncClient(
            {
                "result": {
                    "verdict": {
                        "addressComplete": False,
                        "validationGranularity": "OTHER",
                        "geocodeGranularity": "OTHER",
                    },
                    "address": {"formattedAddress": payload.formattedAddress},
                    "geocode": {
                        "placeId": payload.placeId,
                        "location": {"latitude": payload.lat, "longitude": payload.lon},
                    },
                }
            }
        ),
    )

    result = asyncio.run(address_validation_service.validate_pickup_address(payload))
    assert result["validationLevel"] == "google_geo_confirmed"
    assert result["isCourierReady"] is True


def test_service_returns_needs_more_detail_for_other_granularity_when_structured_fields_weak(
    monkeypatch,
) -> None:
    weak = _valid_payload()
    weak["houseOrFlat"] = "ab"
    weak["address1"] = "Anand Nagar"
    with pytest.raises(ValueError):
        address_validation_service._validate_structured_precheck(
            address_validation_service.PickupAddressValidationRequest(**weak),
            mode="pickup",
        )
