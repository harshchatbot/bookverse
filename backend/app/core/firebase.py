import json
from functools import lru_cache
from typing import Any

import firebase_admin
from firebase_admin import auth, credentials, firestore

from app.core.config import get_settings


def _build_service_account() -> dict[str, Any]:
    settings = get_settings()

    if settings.firebase_service_account_json:
        return json.loads(settings.firebase_service_account_json)

    if (
        settings.firebase_project_id
        and settings.firebase_client_email
        and settings.firebase_private_key
    ):
        return {
            "type": "service_account",
            "project_id": settings.firebase_project_id,
            "client_email": settings.firebase_client_email,
            "private_key": settings.firebase_private_key.replace("\\n", "\n"),
            "token_uri": "https://oauth2.googleapis.com/token",
        }

    raise RuntimeError("Firebase Admin is not configured.")


@lru_cache(maxsize=1)
def get_firebase_app() -> firebase_admin.App:
    if firebase_admin._apps:
        return firebase_admin.get_app()

    service_account = _build_service_account()
    cred = credentials.Certificate(service_account)
    return firebase_admin.initialize_app(
        cred,
        {"projectId": service_account.get("project_id") or get_settings().firebase_project_id},
    )


def get_firestore() -> firestore.Client:
    app = get_firebase_app()
    return firestore.client(app=app)


def verify_firebase_token(id_token: str) -> dict[str, Any]:
    app = get_firebase_app()
    return auth.verify_id_token(id_token, app=app)

