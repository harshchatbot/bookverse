from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.services import rewards_service

router = APIRouter()


@router.get("/summary")
def rewards_summary(current_user: dict = Depends(get_current_user)) -> dict:
    return rewards_service.get_rewards_summary(current_user["uid"])
