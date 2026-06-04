from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def _fake_user(_authorization: str | None = None) -> dict[str, str]:
    return {"uid": "user-123", "email": "user@example.com", "decoded": {"uid": "user-123"}}


def test_dashboard_metrics_defaults_when_orders_unavailable(monkeypatch) -> None:
    from app.routers import dashboard
    from app.services import dashboard_service

    app.dependency_overrides[dashboard.get_current_user] = _fake_user

    def fail_metrics(_uid: str) -> dict:
        return {
            "sellerEarnings": 0,
            "sellerOrderCount": 0,
            "buyerTotalSpent": 0,
            "unavailable": True,
        }

    monkeypatch.setattr(dashboard_service, "get_user_order_metrics", fail_metrics)

    response = client.get("/dashboard/order-metrics", headers={"Authorization": "Bearer test"})

    assert response.status_code == 200
    assert response.json() == {
        "sellerEarnings": 0,
        "sellerOrderCount": 0,
        "buyerTotalSpent": 0,
        "unavailable": True,
    }

    app.dependency_overrides.clear()


def test_rewards_summary_defaults_when_docs_missing(monkeypatch) -> None:
    from app.routers import rewards
    from app.services import rewards_service

    app.dependency_overrides[rewards.get_current_user] = _fake_user

    def default_summary(_uid: str) -> dict:
        return {
            "rewards": {
                "userUid": "user-123",
                "availablePoints": 0,
                "lifetimePoints": 0,
                "badges": [],
                "monthlyCouponRedemptions": 0,
                "monthlyCouponRedemptionMonth": None,
                "referralCode": "BOOKUSER12",
                "updatedAt": None,
            },
            "availableCoupons": [],
            "allCoupons": [],
            "history": [],
            "unavailable": False,
        }

    monkeypatch.setattr(rewards_service, "get_rewards_summary", default_summary)

    response = client.get("/rewards/summary", headers={"Authorization": "Bearer test"})

    assert response.status_code == 200
    assert response.json()["rewards"]["availablePoints"] == 0
    assert response.json()["availableCoupons"] == []
    assert response.json()["history"] == []

    app.dependency_overrides.clear()
