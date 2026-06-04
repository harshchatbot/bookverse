from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.services import dashboard_service

router = APIRouter()


@router.get("/order-metrics")
def order_metrics(current_user: dict = Depends(get_current_user)) -> dict:
    return dashboard_service.get_user_order_metrics(current_user["uid"])
