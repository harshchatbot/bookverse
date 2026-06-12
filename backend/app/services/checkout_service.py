from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping
from datetime import datetime
import logging
from typing import Any

from google.cloud import firestore

from app.core.firebase import get_firestore
from app.services.fulfillment_service import run_fulfillment
from app.services.razorpay_service import (
    create_razorpay_order,
    estimate_gateway_fee,
    get_razorpay_key_id,
    verify_razorpay_signature,
)
from app.services.rewards_service import get_coupons_by_ids, mark_coupon_used_for_order
from app.services.shiprocket_service import check_serviceability

FREE_DELIVERY_REWARD_CODE = "FREEDEL50"
FREE_DELIVERY_MAX_DISCOUNT = 50
PLATFORM_SUPPORT_FEE_INR = 1
PROTECTED_DELIVERY_MAX_ITEMS_PER_SELLER = 10
logger = logging.getLogger(__name__)


def normalize_listing_ids(ids: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for raw_id in ids:
        listing_id = raw_id.strip()
        if not listing_id or listing_id in seen:
            continue
        seen.add(listing_id)
        normalized.append(listing_id)
    return normalized


def estimate_listing_weight_kg(_: Mapping[str, Any]) -> float:
    return 0.5


def estimate_parcel_dimensions(item_count: int) -> dict[str, int]:
    safe_count = max(1, min(item_count, PROTECTED_DELIVERY_MAX_ITEMS_PER_SELLER))
    return {
        "lengthCm": 22,
        "breadthCm": 16,
        "heightCm": min(24, 4 + (safe_count - 1) * 2),
    }


def get_order_items_subtotal(items: list[dict[str, Any]]) -> int:
    return sum(int(item["price"]) * int(item.get("quantity", 1)) for item in items)


def get_order_total_weight(items: list[dict[str, Any]]) -> float:
    return round(
        sum(float(item.get("estimatedWeightKg", 0.5)) * int(item.get("quantity", 1)) for item in items),
        2,
    )


def get_shipping_coupon_discount(shipping_fee: int, coupon_applied: bool) -> int:
    return min(shipping_fee, FREE_DELIVERY_MAX_DISCOUNT) if coupon_applied else 0


def get_protected_delivery_buyer_total(
    *, subtotal: int, shipping_fee: int, coupon_discount: int = 0, platform_support_fee: int = 1
) -> int:
    return subtotal + max(0, shipping_fee - coupon_discount) + platform_support_fee


def _is_complete_pickup_address(value: Any) -> bool:
    if not isinstance(value, Mapping):
        return False
    phone = str(value.get("phone", "")).strip()
    email = str(value.get("email", "")).strip()
    pickup_location_name = str(value.get("pickupLocationName") or value.get("location") or "").strip()
    address_line_1 = str(value.get("address1") or value.get("address") or "").strip()
    valid_phone = (
        phone.isdigit() and len(phone) == 10 and phone[0] in {"6", "7", "8", "9"}
    ) or (phone.startswith("+91") and phone[3:].isdigit() and len(phone) == 13)
    valid_email = "@" in email and "." in email.split("@")[-1]
    house_or_flat = str(value.get("houseOrFlat", "")).strip()
    area_or_locality = str(value.get("areaOrLocality", "")).strip()
    landmark = str(value.get("landmark", "")).strip()
    return (
        bool(pickup_location_name)
        and isinstance(value.get("name"), str)
        and value["name"].strip()
        and valid_phone
        and valid_email
        and (
            (
                len(house_or_flat) >= 3
                and len(area_or_locality) >= 2
                and len(landmark) >= 2
            )
            or len(address_line_1) >= 3
        )
        and isinstance(value.get("city"), str)
        and value["city"].strip()
        and isinstance(value.get("state"), str)
        and value["state"].strip()
        and isinstance(value.get("pincode"), str)
        and value["pincode"].isdigit()
        and len(value["pincode"]) == 6
    )


def _is_google_validated_pickup_address(value: Any) -> bool:
    if not _is_complete_pickup_address(value) or not isinstance(value, Mapping):
        return False
    lat = value.get("lat")
    lon = value.get("lon")
    formatted_address = value.get("formattedAddress")
    return (
        (value.get("isCourierReady") is True or value.get("isAddressReady") is True)
        and value.get("validationLevel") in {"google_validated", "google_geo_confirmed"}
        and (value.get("sellerConfirmed") is True or value.get("userConfirmed") is True)
        and isinstance(formatted_address, str)
        and formatted_address.strip()
        and isinstance(lat, (int, float))
        and isinstance(lon, (int, float))
        and (
            (
                isinstance(value.get("houseOrFlat"), str)
                and value.get("houseOrFlat", "").strip()
                and isinstance(value.get("areaOrLocality"), str)
                and value.get("areaOrLocality", "").strip()
                and isinstance(value.get("landmark"), str)
                and value.get("landmark", "").strip()
            )
            or isinstance(value.get("address1"), str)
        )
    )


def _is_complete_delivery_address(value: Any) -> bool:
    if not isinstance(value, Mapping):
        return False
    phone = str(value.get("phone", "")).strip()
    email = str(value.get("email", "")).strip()
    house_or_flat = str(value.get("houseOrFlat", "")).strip()
    area_or_locality = str(value.get("areaOrLocality", "")).strip()
    landmark = str(value.get("landmark", "")).strip()
    return (
        isinstance(value.get("name"), str)
        and value["name"].strip()
        and (
            (phone.startswith("+91") and phone[3:].isdigit() and len(phone) == 13)
            or (phone.isdigit() and len(phone) == 10 and phone[0] in {"6", "7", "8", "9"})
        )
        and "@" in email
        and "." in email.split("@")[-1]
        and house_or_flat
        and area_or_locality
        and landmark
        and isinstance(value.get("city"), str)
        and value["city"].strip()
        and isinstance(value.get("state"), str)
        and value["state"].strip()
        and isinstance(value.get("pincode"), str)
        and value["pincode"].isdigit()
        and len(value["pincode"]) == 6
        and isinstance(value.get("country"), str)
        and value["country"].strip()
    )


def _is_google_validated_delivery_address(value: Any) -> bool:
    if not _is_complete_delivery_address(value) or not isinstance(value, Mapping):
        return False
    lat = value.get("lat")
    lon = value.get("lon")
    formatted_address = value.get("formattedAddress")
    return (
        value.get("isDeliveryReady") is True
        and value.get("validationLevel") in {"google_validated", "google_geo_confirmed"}
        and value.get("buyerConfirmed") is True
        and isinstance(value.get("placeId"), str)
        and value.get("placeId", "").strip()
        and isinstance(formatted_address, str)
        and formatted_address.strip()
        and isinstance(lat, (int, float))
        and isinstance(lon, (int, float))
        and isinstance(value.get("houseOrFlat"), str)
        and value.get("houseOrFlat", "").strip()
        and isinstance(value.get("areaOrLocality"), str)
        and value.get("areaOrLocality", "").strip()
        and isinstance(value.get("landmark"), str)
        and value.get("landmark", "").strip()
    )


def _order_summary(order: Mapping[str, Any]) -> str:
    items = order.get("items") if isinstance(order.get("items"), list) else []
    if not items:
        return "your books"
    if len(items) == 1:
        return str(items[0].get("title", "your book"))
    first = items[0]
    return f'{first.get("title", "Your book")} + {len(items) - 1} more book{"s" if len(items) > 2 else ""}'


async def create_checkout_orders(*, uid: str, email: str | None, payload: dict[str, Any]) -> dict[str, Any]:
    listing_ids = normalize_listing_ids(payload["listingIds"])
    if len(listing_ids) != len(payload["listingIds"]):
        raise ValueError("Duplicate listing IDs are not allowed.")

    coupon_selections = payload.get("couponSelections") or []
    seen_coupon_ids: set[str] = set()
    coupon_selection_by_seller: dict[str, str] = {}
    for selection in coupon_selections:
        seller_uid = selection["sellerUid"]
        coupon_id = selection["couponId"]
        if seller_uid in coupon_selection_by_seller:
            raise ValueError("Only one coupon can be applied per seller group.")
        if coupon_id in seen_coupon_ids:
            raise ValueError("The same coupon cannot be used across multiple seller groups.")
        seen_coupon_ids.add(coupon_id)
        coupon_selection_by_seller[seller_uid] = coupon_id

    db = get_firestore()
    listing_snapshots = [db.collection("listings").document(listing_id).get() for listing_id in listing_ids]
    for index, snapshot in enumerate(listing_snapshots):
        if not snapshot.exists:
            raise LookupError(f"Listing not found: {listing_ids[index]}")

    listings = [{"id": snap.id, **(snap.to_dict() or {})} for snap in listing_snapshots]

    for listing in listings:
        if listing.get("status") != "approved" or listing.get("deliveryType") != "shipping":
            raise RuntimeError(f'"{listing.get("title", "This listing")}" is not available for protected delivery.')
        if listing.get("sellerUid") == uid:
            raise ValueError("You cannot buy your own listing.")

    grouped_by_seller: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for listing in listings:
        grouped_by_seller[str(listing["sellerUid"])].append(listing)

    for seller_uid in coupon_selection_by_seller:
        if seller_uid not in grouped_by_seller:
            raise ValueError("Coupon selection does not match the current seller groups.")

    coupons = get_coupons_by_ids(uid, list(seen_coupon_ids))
    coupon_by_id = {coupon["id"]: coupon for coupon in coupons}
    for coupon_id in seen_coupon_ids:
        coupon = coupon_by_id.get(coupon_id)
        if not coupon:
            raise LookupError("Selected coupon was not found.")
        if coupon["status"] != "unused":
            raise RuntimeError("Selected coupon is no longer available.")
        if coupon.get("expiresAt") and datetime.fromisoformat(str(coupon["expiresAt"])).timestamp() < datetime.utcnow().timestamp():
            raise RuntimeError("Selected coupon has expired.")

    prepared_groups: list[dict[str, Any]] = []
    address = payload["buyerDeliveryAddress"]
    if not _is_google_validated_delivery_address(address):
        raise RuntimeError(
            "Buyer delivery address is not validated yet. Please select address on map and validate it."
        )

    for seller_uid, seller_listings in grouped_by_seller.items():
        if len(seller_listings) > PROTECTED_DELIVERY_MAX_ITEMS_PER_SELLER:
            raise ValueError(
                f"You can buy up to {PROTECTED_DELIVERY_MAX_ITEMS_PER_SELLER} books per seller in one protected delivery order."
            )

        seller_profile_snap = db.collection("profiles").document(seller_uid).get()
        seller_profile = seller_profile_snap.to_dict() or {}
        pickup_address = seller_profile.get("homeAddress") or seller_profile.get("pickupAddress")
        if not _is_google_validated_pickup_address(pickup_address):
            raise RuntimeError(
                "Seller Home Address is not validated yet. Seller must validate Home Address before protected delivery can be used."
            )

        items = []
        for listing in seller_listings:
            items.append(
                {
                    "listingId": listing["id"],
                    "sellerUid": seller_uid,
                    "title": listing.get("title", "Book"),
                    "author": listing.get("author", ""),
                    "image": (listing.get("images") or [""])[0] if isinstance(listing.get("images"), list) else "",
                    "category": listing.get("category", ""),
                    "condition": listing.get("condition", ""),
                    "price": int(listing.get("sellingPrice", 0)),
                    "quantity": 1,
                    "estimatedWeightKg": estimate_listing_weight_kg(listing),
                }
            )
        invalid_item = next((item for item in items if item["price"] <= 0), None)
        if invalid_item:
            raise RuntimeError(f'Invalid price found for "{invalid_item["title"]}".')

        subtotal = get_order_items_subtotal(items)
        total_weight = get_order_total_weight(items)
        serviceability = await check_serviceability(
            pickup_pincode=str(pickup_address["pincode"]),
            delivery_pincode=str(address["pincode"]),
            declared_value=subtotal,
            weight_kg=total_weight,
        )
        if not serviceability["available"]:
            seller_name = seller_listings[0].get("sellerName") or "this seller"
            raise RuntimeError(
                f"Protected delivery is not available from {seller_name} to your pincode right now."
            )

        prepared_groups.append(
            {
                "sellerUid": seller_uid,
                "sellerEmail": str(seller_listings[0].get("sellerEmail", "")),
                "sellerName": seller_listings[0].get("sellerName") or "Seller",
                "pickupAddress": pickup_address,
                "items": items,
                "subtotal": subtotal,
                "totalWeightKg": total_weight,
                "shippingFee": int(serviceability["rate"]),
                "courierId": int(serviceability["courierId"]),
                "courierName": str(serviceability["courierName"]),
                "parcel": estimate_parcel_dimensions(len(items)),
            }
        )

    groups: list[dict[str, Any]] = []
    for group in prepared_groups:
        coupon_id = coupon_selection_by_seller.get(group["sellerUid"])
        coupon = coupon_by_id.get(coupon_id) if coupon_id else None
        coupon_discount = get_shipping_coupon_discount(group["shippingFee"], coupon is not None)
        buyer_delivery_payable = max(0, group["shippingFee"] - coupon_discount)
        platform_support_fee = PLATFORM_SUPPORT_FEE_INR
        gateway_fee = estimate_gateway_fee(group["subtotal"] + buyer_delivery_payable + platform_support_fee)
        total = get_protected_delivery_buyer_total(
            subtotal=group["subtotal"],
            shipping_fee=group["shippingFee"],
            coupon_discount=coupon_discount,
            platform_support_fee=platform_support_fee,
        )
        platform_fee = platform_support_fee
        seller_amount = group["subtotal"]

        order_ref = db.collection("orders").document()
        receipt = f"bv_{order_ref.id[:30]}"
        razorpay_order = await create_razorpay_order(
            {
                "amount": round(total * 100),
                "currency": "INR",
                "receipt": receipt,
                "notes": {
                    "buyerUid": uid,
                    "sellerUid": group["sellerUid"],
                    "orderId": order_ref.id,
                    "listingIds": ",".join(item["listingId"] for item in group["items"]),
                    "itemCount": str(len(group["items"])),
                },
            }
        )

        order_ref.set(
            {
                "buyerId": uid,
                "buyerUid": uid,
                "buyerEmail": email or address["email"],
                "sellerId": group["sellerUid"],
                "sellerUid": group["sellerUid"],
                "sellerEmail": group["sellerEmail"],
                "fulfillmentMode": payload["selectedFulfillmentMode"],
                "items": group["items"],
                "itemCount": len(group["items"]),
                "listing": {
                    "id": group["items"][0]["listingId"] if group["items"] else "",
                    "title": group["items"][0]["title"] if group["items"] else "Book",
                    "author": group["items"][0]["author"] if group["items"] else "",
                    "image": group["items"][0]["image"] if group["items"] else "",
                    "condition": group["items"][0]["condition"] if group["items"] else "",
                    "category": group["items"][0]["category"] if group["items"] else "",
                    "originalPrice": None,
                },
                "listingId": group["items"][0]["listingId"] if group["items"] else None,
                "pickupAddress": group["pickupAddress"],
                "shippingAddress": address,
                "courierId": group["courierId"],
                "courierName": group["courierName"],
                "subtotal": group["subtotal"],
                "bookPrice": group["subtotal"],
                "amount": total,
                "currency": "INR",
                "shippingFee": group["shippingFee"],
                "gatewayFee": gateway_fee,
                "platformFee": platform_fee,
                "platformSupportFee": platform_support_fee,
                "couponId": coupon_id,
                "couponCode": FREE_DELIVERY_REWARD_CODE if coupon else None,
                "couponDiscount": coupon_discount,
                "bookVerseShippingSubsidy": coupon_discount,
                "totalAmount": total,
                "sellerAmount": seller_amount,
                "totalWeightKg": group["totalWeightKg"],
                "parcelDimensions": group["parcel"],
                "status": "pending_payment",
                "orderStatus": "created",
                "paymentStatus": "pending",
                "shipmentStatus": "pending",
                "fulfillmentStatus": "pending",
                "paymentId": None,
                "razorpayOrderId": razorpay_order["id"],
                "razorpayPaymentId": None,
                "shipmentId": None,
                "shiprocketOrderId": None,
                "shiprocketShipmentId": None,
                "awb": None,
                "courierAssigned": None,
                "trackingUrl": None,
                "payoutId": None,
                "deliveredAt": None,
                "payoutEligibleAt": None,
                "cancelledAt": None,
                "hasOpenDispute": False,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )
        logger.info(
            "Firestore order creation success orderId=%s buyerId=%s sellerId=%s listingId=%s amount=%s",
            order_ref.id,
            uid,
            group["sellerUid"],
            group["items"][0]["listingId"] if group["items"] else None,
            total,
        )

        groups.append(
            {
                "orderId": order_ref.id,
                "sellerUid": group["sellerUid"],
                "sellerName": group["sellerName"],
                "listingIds": [item["listingId"] for item in group["items"]],
                "itemCount": len(group["items"]),
                "items": group["items"],
                "razorpayOrderId": razorpay_order["id"],
                "amount": int(razorpay_order["amount"]),
                "currency": razorpay_order["currency"],
                "key": get_razorpay_key_id(),
                "buyerName": address["name"],
                "buyerEmail": address["email"],
                "buyerPhone": address["phone"],
                "courierName": group["courierName"],
                "breakdown": {
                    "subtotal": group["subtotal"],
                    "shippingFee": group["shippingFee"],
                    "gatewayFee": gateway_fee,
                    "platformSupportFee": platform_support_fee,
                    "couponDiscount": coupon_discount,
                    "buyerDeliveryPayable": buyer_delivery_payable,
                    "bookVerseShippingSubsidy": coupon_discount,
                    "total": total,
                },
            }
        )

    return {"groups": groups}


async def verify_checkout_payment(
    *,
    uid: str,
    order_id: str,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    email: str | None,
) -> dict[str, Any]:
    if not verify_razorpay_signature(
        razorpay_order_id=razorpay_order_id,
        razorpay_payment_id=razorpay_payment_id,
        signature=razorpay_signature,
    ):
        raise ValueError("Signature verification failed")

    db = get_firestore()
    order_ref = db.collection("orders").document(order_id)
    order_snap = order_ref.get()
    if not order_snap.exists:
        raise LookupError("Order not found")
    order = order_snap.to_dict() or {}
    if order.get("buyerUid") != uid:
        raise PermissionError("Not your order")
    if order.get("razorpayOrderId") != razorpay_order_id:
        raise ValueError("Order/payment mismatch")
    if order.get("status") != "pending_payment":
        return {"ok": True, "orderId": order_ref.id, "status": order.get("status")}

    payment_ref = db.collection("payments").document()
    payment_ref.set(
        {
            "orderId": order_ref.id,
            "buyerId": uid,
            "buyerUid": uid,
            "sellerUid": order.get("sellerUid"),
            "razorpayOrderId": razorpay_order_id,
            "razorpayPaymentId": razorpay_payment_id,
            "razorpaySignature": razorpay_signature,
            "amount": order.get("totalAmount"),
            "currency": "INR",
            "status": "captured",
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
    )

    order_ref.update(
        {
            "status": "paid",
            "orderStatus": "created",
            "paymentStatus": "captured",
            "fulfillmentStatus": str(order.get("fulfillmentStatus") or "pending"),
            "paymentId": payment_ref.id,
            "razorpayPaymentId": razorpay_payment_id,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )
    logger.info(
        "Firestore order payment captured orderId=%s buyerId=%s razorpayPaymentId=%s",
        order_ref.id,
        uid,
        razorpay_payment_id,
    )

    mark_coupon_used_for_order(
        coupon_id=order.get("couponId") if isinstance(order.get("couponId"), str) else None,
        uid=uid,
        order_id=order_ref.id,
    )

    items = order.get("items") if isinstance(order.get("items"), list) else []
    batch = db.batch()
    for item in items:
        listing_id = item.get("listingId")
        if listing_id:
            batch.update(
                db.collection("listings").document(str(listing_id)),
                {"status": "sold", "updatedAt": firestore.SERVER_TIMESTAMP},
            )
    batch.commit()

    payout_ref = db.collection("seller_payouts").document()
    payout_ref.set(
        {
            "orderId": order_ref.id,
            "sellerUid": order.get("sellerUid"),
            "sellerEmail": order.get("sellerEmail", ""),
            "amount": order.get("sellerAmount"),
            "status": "pending",
            "eligibleAt": None,
            "paidAt": None,
            "mode": None,
            "reference": None,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )
    order_ref.update({"payoutId": payout_ref.id})

    shipment_result = await run_fulfillment(order_ref.id)

    summary = _order_summary(order)
    buyer_email = email or order.get("buyerEmail") or ""
    db.collection("notifications").document().set(
        {
            "userUid": uid,
            "type": "order_placed",
            "title": "Payment received",
            "body": f'Your protected delivery order for "{summary}" is confirmed.',
            "link": f"/order/{order_ref.id}",
            "read": False,
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
    )
    db.collection("notifications").document().set(
        {
            "userUid": order.get("sellerUid"),
            "type": "order_received",
            "title": "You have a new order",
            "body": f'"{summary}" was purchased. Please pack the books together for pickup.',
            "link": "/sell-orders",
            "read": False,
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
    )

    return {"ok": True, "orderId": order_ref.id, "shipment": shipment_result}
