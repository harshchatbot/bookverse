from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_dashboard_metrics_requires_auth() -> None:
    response = client.get("/dashboard/order-metrics")

    assert response.status_code == 401


def test_rewards_summary_requires_auth() -> None:
    response = client.get("/rewards/summary")

    assert response.status_code == 401

