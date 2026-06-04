from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = Field(default="local", alias="ENVIRONMENT")
    frontend_origin: str = Field(default="http://localhost:3000", alias="FRONTEND_ORIGIN")
    extra_frontend_origins: str | None = Field(default=None, alias="EXTRA_FRONTEND_ORIGINS")
    firebase_project_id: str | None = Field(default=None, alias="FIREBASE_PROJECT_ID")
    firebase_service_account_json: str | None = Field(
        default=None, alias="FIREBASE_SERVICE_ACCOUNT_JSON"
    )
    firebase_client_email: str | None = Field(default=None, alias="FIREBASE_CLIENT_EMAIL")
    firebase_private_key: str | None = Field(default=None, alias="FIREBASE_PRIVATE_KEY")
    google_maps_server_api_key: str | None = Field(
        default=None, alias="GOOGLE_MAPS_SERVER_API_KEY"
    )
    razorpay_key_id: str | None = Field(default=None, alias="RAZORPAY_KEY_ID")
    razorpay_key_secret: str | None = Field(default=None, alias="RAZORPAY_KEY_SECRET")
    shiprocket_email: str | None = Field(default=None, alias="SHIPROCKET_EMAIL")
    shiprocket_password: str | None = Field(default=None, alias="SHIPROCKET_PASSWORD")
    shiprocket_token: str | None = Field(default=None, alias="SHIPROCKET_TOKEN")
    shiprocket_mode: str | None = Field(default=None, alias="SHIPROCKET_MODE")
    shiprocket_auto_create_after_payment: str | None = Field(
        default=None, alias="SHIPROCKET_AUTO_CREATE_AFTER_PAYMENT"
    )
    shiprocket_allow_live_order_creation: str | None = Field(
        default=None, alias="SHIPROCKET_ALLOW_LIVE_ORDER_CREATION"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
