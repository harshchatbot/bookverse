from collections.abc import Mapping
from typing import Any

from fastapi import Header, HTTPException, status

from app.core.firebase import verify_firebase_token


def get_current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header.",
        )

    try:
        decoded = verify_firebase_token(token)
    except Exception as exc:  # pragma: no cover - firebase exception details vary
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase token.",
        ) from exc

    email = decoded.get("email") if isinstance(decoded, Mapping) else None
    return {"uid": decoded.get("uid"), "email": email, "decoded": decoded}
