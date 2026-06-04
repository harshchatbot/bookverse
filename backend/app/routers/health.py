from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.core.firebase import get_firebase_app

router = APIRouter()


@router.get("")
def health() -> dict[str, object]:
    return {"ok": True, "service": "bookverse-api"}


@router.get("/firebase")
def health_firebase() -> dict[str, object]:
    try:
        app = get_firebase_app()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Firebase Admin is not configured.") from exc

    project_id = app.project_id or get_settings().firebase_project_id
    if not project_id:
        raise HTTPException(status_code=500, detail="Firebase project ID is unavailable.")

    return {"ok": True, "firebaseProjectId": project_id}

