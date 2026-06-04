from collections.abc import Mapping
from datetime import datetime
from typing import Any, Literal, cast

from google.cloud.firestore_v1 import FieldFilter

from app.core.firebase import get_firestore

RewardBadge = Literal["Book Buddy", "Campus Promoter", "BookVerse Champion"]
CouponStatus = Literal["unused", "used", "expired"]
RewardEventStatus = Literal["approved", "pending", "reversed"]

FREE_DELIVERY_REWARD_CODE = "FREEDEL50"


def _to_number(value: Any) -> int:
    return int(value) if isinstance(value, (int, float)) else 0


def _to_string_or_none(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _build_referral_code(uid: str) -> str:
    return f"BOOK{''.join(char for char in uid if char.isalnum())[:6].upper()}"


def _reward_badges(lifetime_points: int) -> list[RewardBadge]:
    badges: list[RewardBadge] = []
    if lifetime_points >= 50:
        badges.append("Book Buddy")
    if lifetime_points >= 200:
        badges.append("Campus Promoter")
    if lifetime_points >= 500:
        badges.append("BookVerse Champion")
    return badges


def _serialize_rewards(uid: str, data: Mapping[str, Any] | None = None) -> dict[str, Any]:
    source = data or {}
    lifetime_points = _to_number(source.get("lifetimePoints"))
    return {
        "userUid": uid,
        "availablePoints": _to_number(source.get("availablePoints")),
        "lifetimePoints": lifetime_points,
        "badges": _reward_badges(lifetime_points),
        "monthlyCouponRedemptions": _to_number(source.get("monthlyCouponRedemptions")),
        "monthlyCouponRedemptionMonth": _to_string_or_none(
            source.get("monthlyCouponRedemptionMonth")
        ),
        "referralCode": _to_string_or_none(source.get("referralCode")) or _build_referral_code(uid),
        "updatedAt": _to_string_or_none(source.get("updatedAt")),
    }


def _normalize_coupon_status(value: Any) -> CouponStatus:
    return cast(CouponStatus, value) if value in {"unused", "used", "expired"} else "unused"


def _serialize_coupon(doc_id: str, data: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": doc_id,
        "userUid": str(data.get("userUid", "")),
        "code": FREE_DELIVERY_REWARD_CODE,
        "type": "delivery_discount",
        "maxDiscount": _to_number(data.get("maxDiscount")) or 50,
        "minOrderValue": _to_number(data.get("minOrderValue")),
        "status": _normalize_coupon_status(data.get("status")),
        "issuedAt": _to_string_or_none(data.get("issuedAt")),
        "expiresAt": _to_string_or_none(data.get("expiresAt")),
        "usedAt": _to_string_or_none(data.get("usedAt")),
        "orderId": _to_string_or_none(data.get("orderId")),
        "issuedMonth": _to_string_or_none(data.get("issuedMonth")),
    }


def _normalize_event_status(value: Any) -> RewardEventStatus:
    return cast(RewardEventStatus, value) if value in {"approved", "pending", "reversed"} else "approved"


def _serialize_event(doc_id: str, data: Mapping[str, Any]) -> dict[str, Any]:
    metadata = data.get("metadata")
    return {
        "id": doc_id,
        "userUid": str(data.get("userUid", "")),
        "type": str(data.get("type", "")),
        "points": _to_number(data.get("points")),
        "status": _normalize_event_status(data.get("status")),
        "relatedListingId": _to_string_or_none(data.get("relatedListingId")),
        "relatedOrderId": _to_string_or_none(data.get("relatedOrderId")),
        "createdAt": _to_string_or_none(data.get("createdAt")),
        "metadata": metadata if isinstance(metadata, Mapping) else None,
    }


def get_rewards_summary(uid: str) -> dict[str, Any]:
    fallback = {
        "rewards": _serialize_rewards(uid),
        "availableCoupons": [],
        "allCoupons": [],
        "history": [],
        "unavailable": False,
    }

    try:
        db = get_firestore()
        rewards_snap = db.collection("user_rewards").document(uid).get()
        coupons_stream = (
            db.collection("user_coupons")
            .where(filter=FieldFilter("userUid", "==", uid))
            .stream()
        )
        history_stream = (
            db.collection("reward_events")
            .where(filter=FieldFilter("userUid", "==", uid))
            .stream()
        )

        rewards = _serialize_rewards(uid, rewards_snap.to_dict() if rewards_snap.exists else None)
        coupons = sorted(
            [_serialize_coupon(doc.id, doc.to_dict() or {}) for doc in coupons_stream],
            key=lambda item: item.get("issuedAt") or "",
            reverse=True,
        )
        history = sorted(
            [_serialize_event(doc.id, doc.to_dict() or {}) for doc in history_stream],
            key=lambda item: item.get("createdAt") or "",
            reverse=True,
        )[:20]

        return {
            "rewards": rewards,
            "availableCoupons": [coupon for coupon in coupons if coupon["status"] == "unused"],
            "allCoupons": coupons,
            "history": history,
            "unavailable": False,
        }
    except Exception:
        return {**fallback, "unavailable": True}


def get_coupons_by_ids(uid: str, coupon_ids: list[str]) -> list[dict[str, Any]]:
    if not coupon_ids:
        return []

    db = get_firestore()
    snapshots = [db.collection("user_coupons").document(coupon_id).get() for coupon_id in coupon_ids]
    coupons = [
        _serialize_coupon(snapshot.id, snapshot.to_dict() or {})
        for snapshot in snapshots
        if snapshot.exists
    ]
    return [coupon for coupon in coupons if coupon["userUid"] == uid]


def mark_coupon_used_for_order(*, coupon_id: str | None, uid: str, order_id: str) -> None:
    if not coupon_id:
        return

    db = get_firestore()
    coupon_ref = db.collection("user_coupons").document(coupon_id)
    coupon_snap = coupon_ref.get()
    if not coupon_snap.exists:
        return

    coupon = _serialize_coupon(coupon_snap.id, coupon_snap.to_dict() or {})
    if coupon["userUid"] != uid or coupon["status"] != "unused":
        return

    coupon_ref.set(
        {
            "status": "used",
            "usedAt": datetime.utcnow().isoformat(),
            "orderId": order_id,
        },
        merge=True,
    )
