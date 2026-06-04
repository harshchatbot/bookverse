from collections.abc import Mapping
from typing import Any

from google.cloud.firestore_v1 import FieldFilter

from app.core.firebase import get_firestore


def _to_number(value: Any) -> float:
    return float(value) if isinstance(value, (int, float)) else 0.0


def _is_paid_order(data: Mapping[str, Any]) -> bool:
    payment_status = data.get("paymentStatus")
    status = data.get("status")

    return payment_status in {"paid", "captured"} or status in {
        "paid",
        "shipment_created",
        "pickup_scheduled",
        "in_transit",
        "dispute_window",
        "completed",
    }


def get_user_order_metrics(uid: str) -> dict[str, Any]:
    fallback = {
        "sellerEarnings": 0,
        "sellerOrderCount": 0,
        "buyerTotalSpent": 0,
        "unavailable": False,
    }

    try:
        db = get_firestore()
        seller_orders_snap = (
            db.collection("orders")
            .where(filter=FieldFilter("sellerUid", "==", uid))
            .stream()
        )
        buyer_orders_snap = (
            db.collection("orders")
            .where(filter=FieldFilter("buyerUid", "==", uid))
            .stream()
        )

        seller_orders = [doc.to_dict() or {} for doc in seller_orders_snap]
        buyer_orders = [doc.to_dict() or {} for doc in buyer_orders_snap]

        paid_seller_orders = [order for order in seller_orders if _is_paid_order(order)]
        paid_buyer_orders = [order for order in buyer_orders if _is_paid_order(order)]

        return {
            "sellerEarnings": sum(
                _to_number(order.get("sellerAmount")) or _to_number(order.get("subtotal"))
                for order in paid_seller_orders
            ),
            "sellerOrderCount": len(paid_seller_orders),
            "buyerTotalSpent": sum(_to_number(order.get("totalAmount")) for order in paid_buyer_orders),
            "unavailable": False,
        }
    except Exception:
        return {**fallback, "unavailable": True}
