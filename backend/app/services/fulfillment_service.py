from __future__ import annotations

from datetime import datetime
from typing import Any

from google.cloud import firestore

from app.core.firebase import get_firestore
from app.services.shiprocket_service import (
    assign_awb,
    create_shiprocket_order,
    generate_pickup,
    is_live_shiprocket_order_creation_allowed,
    is_shiprocket_auto_fulfillment_enabled,
    should_create_live_shiprocket_order,
)


def _estimate_parcel_dimensions(item_count: int) -> dict[str, int]:
    safe_count = max(1, min(item_count, 10))
    return {
        "lengthCm": 22,
        "breadthCm": 16,
        "heightCm": min(24, 4 + (safe_count - 1) * 2),
    }


def _get_order_items_subtotal(items: list[dict[str, Any]]) -> int:
    return sum(int(item.get("price", 0)) * int(item.get("quantity", 1)) for item in items)


def _get_order_total_weight(items: list[dict[str, Any]]) -> float:
    weight = sum(float(item.get("estimatedWeightKg", 0.5)) * int(item.get("quantity", 1)) for item in items)
    return round(weight, 2)


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


async def run_fulfillment(order_id: str) -> dict[str, Any]:
    db = get_firestore()
    order_ref = db.collection("orders").document(order_id)
    order_snap = order_ref.get()
    if not order_snap.exists:
        return {"ok": False, "reachedStep": None, "error": "Order not found"}

    order = order_snap.to_dict() or {}
    order_status = str(order.get("status", ""))
    if order_status not in {"paid", "shipment_created", "pickup_scheduled"}:
        return {"ok": False, "reachedStep": None, "error": f"Cannot fulfill from status {order_status}"}

    seller_uid = str(order.get("sellerUid", ""))
    seller_profile_snap = db.collection("profiles").document(seller_uid).get()
    seller_profile = seller_profile_snap.to_dict() or {}
    pickup = seller_profile.get("pickupAddress")
    items = order.get("items") if isinstance(order.get("items"), list) else []
    buyer = order.get("shippingAddress") if isinstance(order.get("shippingAddress"), dict) else None
    if not pickup or not items or not buyer:
        return {"ok": False, "reachedStep": None, "error": "Order fulfillment data missing"}

    if not should_create_live_shiprocket_order():
        order_ref.update(
            {
                "shipmentStatus": "SHIPROCKET_SKIPPED",
                "fulfillmentState": "SHIPROCKET_SKIPPED",
                "fulfillmentSkippedReason": (
                    "mock_mode"
                    if not is_shiprocket_auto_fulfillment_enabled()
                    or not is_live_shiprocket_order_creation_allowed()
                    else "live_mode_disabled"
                ),
                "fulfillmentLastCheckedAt": _now_iso(),
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )
        return {"ok": True, "reachedStep": "order_created"}

    shipment_doc_id = order.get("shipmentId")
    shipment_id = order.get("shiprocketShipmentId")
    reached_step = "order_created"

    if not shipment_id:
        created = await create_shiprocket_order(
            {
                "order_id": order_id,
                "order_date": datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
                "pickup_location": pickup.get("location") or "Primary",
                "billing_customer_name": str(buyer.get("name", "")).split(" ")[0] or "Buyer",
                "billing_last_name": " ".join(str(buyer.get("name", "")).split(" ")[1:]) or ".",
                "billing_address": buyer.get("address1", ""),
                "billing_address_2": buyer.get("address2", ""),
                "billing_city": buyer.get("city", ""),
                "billing_pincode": buyer.get("pincode", ""),
                "billing_state": buyer.get("state", ""),
                "billing_country": buyer.get("country", "India"),
                "billing_email": buyer.get("email", ""),
                "billing_phone": buyer.get("phone", ""),
                "shipping_is_billing": True,
                "order_items": [
                    {
                        "name": item.get("title", "Book"),
                        "sku": item.get("listingId", ""),
                        "units": int(item.get("quantity", 1)),
                        "selling_price": int(item.get("price", 0)),
                    }
                    for item in items
                ],
                "payment_method": "Prepaid",
                "sub_total": int(order.get("subtotal") or _get_order_items_subtotal(items))
                + int(order.get("shippingFee") or 0),
                "length": int((order.get("parcelDimensions") or {}).get("lengthCm", _estimate_parcel_dimensions(len(items))["lengthCm"])),
                "breadth": int((order.get("parcelDimensions") or {}).get("breadthCm", _estimate_parcel_dimensions(len(items))["breadthCm"])),
                "height": int((order.get("parcelDimensions") or {}).get("heightCm", _estimate_parcel_dimensions(len(items))["heightCm"])),
                "weight": float(order.get("totalWeightKg") or _get_order_total_weight(items)),
            }
        )
        shipment_ref = db.collection("shipments").document()
        shipment_ref.set(
            {
                "orderId": order_id,
                "shiprocketOrderId": created["shiprocketOrderId"],
                "shiprocketShipmentId": created["shipmentId"],
                "status": created["status"],
                "awb": None,
                "courierName": order.get("courierName"),
                "trackingUrl": None,
                "history": [{"status": created["status"], "at": _now_iso()}],
                "createdAt": firestore.SERVER_TIMESTAMP,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )
        shipment_doc_id = shipment_ref.id
        shipment_id = created["shipmentId"]
        order_ref.update(
            {
                "status": "shipment_created",
                "shipmentStatus": "shipment_created",
                "shipmentId": shipment_doc_id,
                "shiprocketOrderId": created["shiprocketOrderId"],
                "shiprocketShipmentId": shipment_id,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )

    awb = order.get("awb")
    if not awb and shipment_id:
        awb_result = await assign_awb(
            shipment_id=int(shipment_id), courier_id=order.get("courierId")
        )
        awb = awb_result["awb"]
        tracking_url = f"https://shiprocket.co/tracking/{awb}"
        if shipment_doc_id:
            db.collection("shipments").document(str(shipment_doc_id)).update(
                {
                    "awb": awb,
                    "courierName": awb_result.get("courierName") or order.get("courierName"),
                    "trackingUrl": tracking_url,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                }
            )
        order_ref.update(
            {
                "awb": awb,
                "courierAssigned": awb_result.get("courierName") or None,
                "trackingUrl": tracking_url,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )
        reached_step = "awb_assigned"

    if order_status != "pickup_scheduled" and shipment_id:
        pickup_result = await generate_pickup(int(shipment_id))
        if shipment_doc_id:
            db.collection("shipments").document(str(shipment_doc_id)).update(
                {
                    "status": "pickup_scheduled",
                    "pickupScheduledAt": pickup_result.get("scheduledDate"),
                    "pickupTokenNumber": pickup_result.get("pickupTokenNumber"),
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                }
            )
        order_ref.update(
            {
                "status": "pickup_scheduled",
                "shipmentStatus": "pickup_scheduled",
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )
        reached_step = "pickup_scheduled"

    return {"ok": True, "reachedStep": reached_step}
