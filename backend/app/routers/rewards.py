from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.services import rewards_service

router = APIRouter()


@router.get("/summary")
def rewards_summary(current_user: dict = Depends(get_current_user)) -> dict:
    return rewards_service.get_rewards_summary(current_user["uid"])


class ApplyReferralBody(BaseModel):
    referralCode: str
    newUserUid: str = ""


@router.post("/apply-referral")
def apply_referral(
    body: ApplyReferralBody,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Apply a referral code for a new user.
    - Awards 10 points to the new user as welcome bonus
    - Awards 20 points to the referrer
    - Each referral code can only be used once per new user
    - A user cannot use their own referral code
    """
    referral_code = body.referralCode.strip().upper()
    if not referral_code:
        raise HTTPException(status_code=400, detail="Referral code is required")

    try:
        return rewards_service.apply_referral(
            new_user_uid=current_user["uid"],
            referral_code=referral_code,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
