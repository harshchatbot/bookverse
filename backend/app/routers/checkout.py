from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.security import get_current_user
from app.services.checkout_service import create_checkout_orders, verify_checkout_payment

router = APIRouter()
logger = logging.getLogger(__name__)


class BuyerDeliveryAddress(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    phone: str
    email: str
    houseOrFlat: str
    buildingOrSociety: str = ""
    streetOrRoad: str = ""
    areaOrLocality: str
    landmark: str
    address1: str = Field(validation_alias="address1")
    address2: str = ""
    city: str
    state: str
    pincode: str
    country: str = "India"
    formattedAddress: str = ""
    placeId: str = ""
    lat: float | None = None
    lon: float | None = None
    buyerConfirmed: bool = False
    isDeliveryReady: bool = False
    validationLevel: str | None = None

    @field_validator("pincode")
    @classmethod
    def validate_pincode(cls, value: str) -> str:
        if not value.isdigit() or len(value) != 6:
            raise ValueError("String should match pattern '^\\d{6}$'")
        return value


class CouponSelection(BaseModel):
    sellerUid: str
    couponId: str


class CreateOrderBody(BaseModel):
    listingIds: list[str]
    buyerDeliveryAddress: BuyerDeliveryAddress
    selectedFulfillmentMode: Literal["protected_delivery"]
    couponSelections: list[CouponSelection] = []


class VerifyBody(BaseModel):
    orderId: str
    razorpayOrderId: str
    razorpayPaymentId: str
    razorpaySignature: str


@router.post("/create-order")
async def create_order(
    body: CreateOrderBody, current_user: dict = Depends(get_current_user)
) -> dict:
    logger.info(
        "Razorpay create order API hit uid=%s listingCount=%s",
        current_user.get("uid"),
        len(body.listingIds),
    )
    if not body.listingIds:
        raise HTTPException(status_code=400, detail="List should have at least 1 item after validation, not 0")
    try:
        return await create_checkout_orders(
            uid=current_user["uid"],
            email=current_user.get("email"),
            payload=body.model_dump(),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Firestore order creation failure")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc) or "Checkout create order failed."
        ) from exc


@router.post("/verify")
async def verify_order(body: VerifyBody, current_user: dict = Depends(get_current_user)) -> dict:
    logger.info(
        "Razorpay verify payment API hit uid=%s orderId=%s razorpayOrderId=%s",
        current_user.get("uid"),
        body.orderId,
        body.razorpayOrderId,
    )
    try:
        return await verify_checkout_payment(
            uid=current_user["uid"],
            order_id=body.orderId,
            razorpay_order_id=body.razorpayOrderId,
            razorpay_payment_id=body.razorpayPaymentId,
            razorpay_signature=body.razorpaySignature,
            email=current_user.get("email"),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Razorpay verify payment failure")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc) or "Checkout verify payment failed.",
        ) from exc
