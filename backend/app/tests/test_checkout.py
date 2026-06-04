from fastapi.testclient import TestClient

from app.main import app
from app.routers import checkout
from app.services import checkout_service


client = TestClient(app)


def _fake_user() -> dict[str, str]:
    return {"uid": "user-123", "email": "user@example.com", "decoded": {"uid": "user-123"}}


def test_create_order_requires_auth() -> None:
    response = client.post("/checkout/create-order", json={})
    assert response.status_code == 401


def test_verify_requires_auth() -> None:
    response = client.post("/checkout/verify", json={})
    assert response.status_code == 401


def test_create_order_rejects_empty_listing_ids() -> None:
    app.dependency_overrides[checkout.get_current_user] = _fake_user
    response = client.post(
        "/checkout/create-order",
        headers={"Authorization": "Bearer test"},
        json={
            "listingIds": [],
            "buyerDeliveryAddress": {
                "name": "Buyer",
                "phone": "9876543210",
                "email": "buyer@example.com",
                "address1": "Hostel Road",
                "address2": "",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110001",
                "country": "India",
            },
            "selectedFulfillmentMode": "protected_delivery",
            "couponSelections": [],
        },
    )
    assert response.status_code == 400
    app.dependency_overrides.clear()


def test_create_order_rejects_invalid_mode() -> None:
    app.dependency_overrides[checkout.get_current_user] = _fake_user
    response = client.post(
        "/checkout/create-order",
        headers={"Authorization": "Bearer test"},
        json={
            "listingIds": ["abc"],
            "buyerDeliveryAddress": {
                "name": "Buyer",
                "phone": "9876543210",
                "email": "buyer@example.com",
                "address1": "Hostel Road",
                "address2": "",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110001",
                "country": "India",
            },
            "selectedFulfillmentMode": "whatsapp",
            "couponSelections": [],
        },
    )
    assert response.status_code == 422
    app.dependency_overrides.clear()


def test_pricing_helpers_keep_seller_payout_unchanged() -> None:
    items = [
        {"price": 500, "quantity": 1, "estimatedWeightKg": 0.5},
        {"price": 300, "quantity": 1, "estimatedWeightKg": 0.5},
    ]
    subtotal = checkout_service.get_order_items_subtotal(items)
    shipping_fee = 80
    coupon_discount = checkout_service.get_shipping_coupon_discount(shipping_fee, True)
    total = checkout_service.get_protected_delivery_buyer_total(
        subtotal=subtotal,
        shipping_fee=shipping_fee,
        coupon_discount=coupon_discount,
        platform_support_fee=1,
    )

    assert subtotal == 800
    assert coupon_discount == 50
    assert total == 831
    assert subtotal == 800


def test_pickup_address_completeness_accepts_courier_ready_shape() -> None:
    assert checkout_service._is_complete_pickup_address(
        {
            "pickupLocationName": "Home",
            "name": "Seller Pickup",
            "phone": "9999999999",
            "email": "pickup@example.com",
            "address1": "123 Test Street",
            "address2": "Block A",
            "city": "Pune",
            "state": "Maharashtra",
            "pincode": "411001",
            "country": "India",
            "landmark": "Near Gate",
        }
    )
    assert checkout_service._is_google_validated_pickup_address(
        {
            "pickupLocationName": "Home",
            "name": "Seller Pickup",
            "phone": "9999999999",
            "email": "pickup@example.com",
            "address1": "123 Test Street",
            "address2": "Block A",
            "city": "Pune",
            "state": "Maharashtra",
            "pincode": "411001",
            "country": "India",
            "landmark": "Near Gate",
            "formattedAddress": "123 Test Street, Pune, Maharashtra 411001, India",
            "lat": 18.5204,
            "lon": 73.8567,
            "sellerConfirmed": True,
            "isCourierReady": True,
            "validationLevel": "google_validated",
        }
    )


def test_pickup_address_completeness_rejects_missing_email() -> None:
    assert not checkout_service._is_complete_pickup_address(
        {
            "pickupLocationName": "Home",
            "name": "Seller Pickup",
            "phone": "9999999999",
            "address1": "123 Test Street",
            "city": "Pune",
            "state": "Maharashtra",
            "pincode": "411001",
            "country": "India",
        }
    )
    assert not checkout_service._is_google_validated_pickup_address(
        {
            "pickupLocationName": "Home",
            "name": "Seller Pickup",
            "phone": "9999999999",
            "email": "pickup@example.com",
            "address1": "123 Test Street",
            "city": "Pune",
            "state": "Maharashtra",
            "pincode": "411001",
            "country": "India",
            "formattedAddress": "123 Test Street, Pune, Maharashtra 411001, India",
            "sellerConfirmed": True,
            "isCourierReady": True,
            "validationLevel": "google_validated",
        }
    )
