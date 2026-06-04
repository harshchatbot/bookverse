from fastapi import APIRouter, Depends, HTTPException, status
from httpx import HTTPError
from pydantic import ValidationError

from app.core.security import get_current_user
from app.services.address_validation_service import (
    PickupAddressValidationRequest,
    validate_pickup_address,
)

router = APIRouter()


@router.post("/validate-pickup")
async def validate_pickup(
    payload: PickupAddressValidationRequest, current_user: dict = Depends(get_current_user)
) -> dict:
    del current_user
    try:
        return await validate_pickup_address(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Address Validation is unavailable right now.",
        ) from exc
