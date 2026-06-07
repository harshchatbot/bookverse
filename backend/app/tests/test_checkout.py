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
                "phone": "+919876543210",
                "email": "buyer@example.com",
                "houseOrFlat": "Flat 302",
                "buildingOrSociety": "Hostel Block A",
                "streetOrRoad": "Campus Road",
                "areaOrLocality": "North Campus",
                "landmark": "Near Main Gate",
                "address1": "Hostel Road",
                "address2": "",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110001",
                "country": "India",
                "formattedAddress": "Flat 302, Hostel Block A, Campus Road, North Campus, Delhi 110001, India",
                "placeId": "delivery-place-id",
                "lat": 28.7041,
                "lon": 77.1025,
                "buyerConfirmed": True,
                "isDeliveryReady": True,
                "validationLevel": "google_validated",
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
                "phone": "+919876543210",
                "email": "buyer@example.com",
                "houseOrFlat": "Flat 302",
                "buildingOrSociety": "Hostel Block A",
                "streetOrRoad": "Campus Road",
                "areaOrLocality": "North Campus",
                "landmark": "Near Main Gate",
                "address1": "Hostel Road",
                "address2": "",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110001",
                "country": "India",
                "formattedAddress": "Flat 302, Hostel Block A, Campus Road, North Campus, Delhi 110001, India",
                "placeId": "delivery-place-id",
                "lat": 28.7041,
                "lon": 77.1025,
                "buyerConfirmed": True,
                "isDeliveryReady": True,
                "validationLevel": "google_validated",
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
            "houseOrFlat": "H.No 10",
            "buildingOrSociety": "Lake View Apartments",
            "streetOrRoad": "Campus Road",
            "areaOrLocality": "Anand Nagar",
            "address1": "H.No 10, Lake View Apartments, Campus Road, Anand Nagar",
            "address2": "Near Gate",
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
            "houseOrFlat": "H.No 10",
            "buildingOrSociety": "Lake View Apartments",
            "streetOrRoad": "Campus Road",
            "areaOrLocality": "Anand Nagar",
            "address1": "H.No 10, Lake View Apartments, Campus Road, Anand Nagar",
            "address2": "Near Gate",
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
    assert checkout_service._is_google_validated_pickup_address(
        {
            "pickupLocationName": "Home",
            "name": "Seller Pickup",
            "phone": "9999999999",
            "email": "pickup@example.com",
            "houseOrFlat": "H.No 10",
            "areaOrLocality": "Anand Nagar",
            "landmark": "Near Gate",
            "address1": "H.No 10, Anand Nagar",
            "city": "Pune",
            "state": "Maharashtra",
            "pincode": "411001",
            "country": "India",
            "formattedAddress": "H.No 10, Anand Nagar, Pune, Maharashtra 411001, India",
            "lat": 18.5204,
            "lon": 73.8567,
            "sellerConfirmed": True,
            "isCourierReady": True,
            "validationLevel": "google_geo_confirmed",
        }
    )


def test_pickup_address_completeness_rejects_missing_email() -> None:
    assert not checkout_service._is_complete_pickup_address(
        {
            "pickupLocationName": "Home",
            "name": "Seller Pickup",
            "phone": "9999999999",
            "houseOrFlat": "H.No 10",
            "areaOrLocality": "Anand Nagar",
            "landmark": "Near Gate",
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


def test_delivery_address_validation_accepts_google_geo_confirmed() -> None:
    assert checkout_service._is_google_validated_delivery_address(
        {
            "name": "Buyer Delivery",
            "phone": "+919999999999",
            "email": "buyer@example.com",
            "houseOrFlat": "H.No 10",
            "buildingOrSociety": "",
            "streetOrRoad": "Ana Sagar Link Road",
            "areaOrLocality": "Anand Nagar",
            "landmark": "Near Anasagar Lake",
            "address1": "H.No 10, Ana Sagar Link Road, Anand Nagar",
            "address2": "Near Anasagar Lake",
            "city": "Ajmer",
            "state": "Rajasthan",
            "pincode": "305001",
            "country": "India",
            "formattedAddress": "H.No 10, Anand Nagar, Ajmer, Rajasthan 305001, India",
            "placeId": "delivery-place-id",
            "lat": 26.4499,
            "lon": 74.6399,
            "buyerConfirmed": True,
            "isDeliveryReady": True,
            "validationLevel": "google_geo_confirmed",
        }
    )


def test_delivery_address_validation_rejects_needs_more_detail() -> None:
    assert not checkout_service._is_google_validated_delivery_address(
        {
            "name": "Buyer Delivery",
            "phone": "+919999999999",
            "email": "buyer@example.com",
            "houseOrFlat": "",
            "areaOrLocality": "Anand Nagar",
            "landmark": "Near Anasagar Lake",
            "address1": "Anand Nagar",
            "address2": "",
            "city": "Ajmer",
            "state": "Rajasthan",
            "pincode": "305001",
            "country": "India",
            "formattedAddress": "Anand Nagar, Ajmer, Rajasthan 305001, India",
            "placeId": "delivery-place-id",
            "lat": 26.4499,
            "lon": 74.6399,
            "buyerConfirmed": True,
            "isDeliveryReady": False,
            "validationLevel": "needs_more_detail",
        }
    )
    assert not checkout_service._is_google_validated_pickup_address(
        {
            "pickupLocationName": "Home",
            "name": "Seller Pickup",
            "phone": "9999999999",
            "email": "pickup@example.com",
            "areaOrLocality": "Anand Nagar",
            "landmark": "Near Gate",
            "city": "Pune",
            "state": "Maharashtra",
            "pincode": "411001",
            "country": "India",
            "formattedAddress": "Anand Nagar, Pune, Maharashtra 411001, India",
            "lat": 18.5204,
            "lon": 73.8567,
            "sellerConfirmed": True,
            "isCourierReady": True,
            "validationLevel": "needs_more_detail",
        }
    )


# ── Group 1: Weight and dimensions helpers ────────────────────────────────────


def test_estimate_listing_weight_returns_half_kg() -> None:
    """Each book defaults to 0.5 kg regardless of listing data."""
    assert checkout_service.estimate_listing_weight_kg({}) == 0.5
    assert checkout_service.estimate_listing_weight_kg({"weight": 1.2}) == 0.5


def test_estimate_parcel_dimensions_scales_with_item_count() -> None:
    single = checkout_service.estimate_parcel_dimensions(1)
    assert single["heightCm"] == 4
    multi = checkout_service.estimate_parcel_dimensions(3)
    assert multi["heightCm"] == 8  # 4 + (3-1)*2
    # Cap at max 10 items
    large = checkout_service.estimate_parcel_dimensions(20)
    assert large["heightCm"] == checkout_service.estimate_parcel_dimensions(10)["heightCm"]


def test_order_total_weight_sums_items() -> None:
    items = [
        {"estimatedWeightKg": 0.5, "quantity": 2},
        {"estimatedWeightKg": 0.5, "quantity": 1},
    ]
    assert checkout_service.get_order_total_weight(items) == 1.5


# ── Group 2: Pricing edge cases ───────────────────────────────────────────────


def test_coupon_discount_capped_at_50() -> None:
    """FREEDEL50 coupon covers up to ₹50 of shipping regardless of actual fee."""
    assert checkout_service.get_shipping_coupon_discount(80, True) == 50
    assert checkout_service.get_shipping_coupon_discount(30, True) == 30  # fee < cap
    assert checkout_service.get_shipping_coupon_discount(80, False) == 0


def test_buyer_total_never_goes_below_subtotal_plus_platform_fee() -> None:
    """Even with full coupon, buyer pays at least subtotal + platform fee."""
    total = checkout_service.get_protected_delivery_buyer_total(
        subtotal=500,
        shipping_fee=40,
        coupon_discount=50,  # coupon > shipping fee
        platform_support_fee=1,
    )
    # shipping_fee - coupon_discount = max(0, 40-50) = 0
    assert total == 501  # subtotal + 0 shipping + 1 platform fee


def test_seller_payout_equals_subtotal_regardless_of_fees() -> None:
    """Seller always receives the book price — shipping and platform fee go elsewhere."""
    items = [{"price": 300, "quantity": 1, "estimatedWeightKg": 0.5}]
    subtotal = checkout_service.get_order_items_subtotal(items)
    shipping_fee = 80
    coupon_discount = checkout_service.get_shipping_coupon_discount(shipping_fee, True)
    total = checkout_service.get_protected_delivery_buyer_total(
        subtotal=subtotal,
        shipping_fee=shipping_fee,
        coupon_discount=coupon_discount,
        platform_support_fee=1,
    )
    # Seller payout = subtotal only, never affected by shipping or platform fee
    assert subtotal == 300
    # 300 + max(0, 80 - 50) + 1 = 300 + 30 + 1 = 331
    assert total == 331
    assert subtotal == 300  # seller payout unchanged


# ── Group 3: Shiprocket serviceability (mocked) ───────────────────────────────


def test_check_serviceability_called_with_correct_pincodes(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """Shiprocket serviceability check passes pickup and delivery pincodes correctly."""
    from app.services import shiprocket_service

    def mock_check_serviceability(pickup_pincode: str, delivery_pincode: str, weight_kg: float):  # type: ignore[no-untyped-def]
        return {"available": True, "rate": 60, "courierId": 1, "courierName": "Delhivery", "etd": "3-5 days"}

    monkeypatch.setattr(shiprocket_service, "check_serviceability", mock_check_serviceability)

    result = shiprocket_service.check_serviceability("411001", "110001", 0.5)
    assert result["rate"] == 60
    assert result["courierId"] == 1
    assert result["available"] is True


def test_check_serviceability_returns_none_for_unserviceable(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """Returns None when no courier covers the route."""
    from app.services import shiprocket_service

    def mock_unserviceable(pickup_pincode: str, delivery_pincode: str, weight_kg: float):  # type: ignore[no-untyped-def]
        return None

    monkeypatch.setattr(shiprocket_service, "check_serviceability", mock_unserviceable)

    result = shiprocket_service.check_serviceability("999999", "888888", 0.5)
    assert result is None


# ── Group 4: Address validation edge cases ────────────────────────────────────


def test_delivery_address_rejects_unconfirmed_buyer() -> None:
    """Address must have buyerConfirmed=True to be delivery-ready."""
    assert not checkout_service._is_google_validated_delivery_address(
        {
            "name": "Buyer",
            "phone": "+919999999999",
            "email": "buyer@example.com",
            "houseOrFlat": "H.No 10",
            "areaOrLocality": "Anand Nagar",
            "landmark": "Near Gate",
            "address1": "H.No 10, Anand Nagar",
            "city": "Pune",
            "state": "Maharashtra",
            "pincode": "411001",
            "country": "India",
            "formattedAddress": "H.No 10, Anand Nagar, Pune 411001",
            "placeId": "test-place-id",
            "lat": 18.5204,
            "lon": 73.8567,
            "buyerConfirmed": False,  # not confirmed
            "isDeliveryReady": True,
            "validationLevel": "google_validated",
        }
    )


def test_pickup_address_rejects_missing_lat_lon() -> None:
    """Google-validated pickup address requires lat/lon coordinates."""
    assert not checkout_service._is_google_validated_pickup_address(
        {
            "pickupLocationName": "Home",
            "name": "Seller",
            "phone": "9999999999",
            "email": "seller@example.com",
            "houseOrFlat": "H.No 10",
            "areaOrLocality": "Anand Nagar",
            "landmark": "Near Gate",
            "address1": "H.No 10, Anand Nagar",
            "city": "Pune",
            "state": "Maharashtra",
            "pincode": "411001",
            "country": "India",
            "formattedAddress": "H.No 10, Anand Nagar, Pune 411001",
            # lat/lon missing
            "sellerConfirmed": True,
            "isCourierReady": True,
            "validationLevel": "google_validated",
        }
    )


def test_normalize_listing_ids_deduplicates() -> None:
    """Duplicate or empty listing IDs are removed."""
    ids = ["abc", "abc", "", "  ", "def", "abc"]
    result = checkout_service.normalize_listing_ids(ids)
    assert result == ["abc", "def"]
    assert len(result) == 2


# ── Group 5: Verify payment endpoint (mocked) ─────────────────────────────────


def test_verify_payment_rejects_missing_fields() -> None:
    """Verify endpoint requires all four Razorpay/order fields."""
    app.dependency_overrides[checkout.get_current_user] = _fake_user
    response = client.post(
        "/checkout/verify",
        headers={"Authorization": "Bearer test"},
        json={
            "razorpayOrderId": "order_123",
            # missing orderId, razorpayPaymentId, and razorpaySignature
        },
    )
    assert response.status_code == 422
    app.dependency_overrides.clear()
