from fastapi import APIRouter, Depends

from app.core.security import get_current_user

router = APIRouter()


@router.get("/me")
def auth_me(current_user: dict = Depends(get_current_user)) -> dict[str, str | None]:
    return {"uid": current_user.get("uid"), "email": current_user.get("email")}

