import pytest
from django.test import override_settings


pytestmark = pytest.mark.django_db


@override_settings(CORS_ALLOWED_ORIGINS=["http://localhost:5173"])
@pytest.mark.parametrize(
    ("origin", "is_allowed"),
    [
        ("http://localhost:5173", True),
        ("https://untrusted.example", False),
    ],
)
def test_cors_respects_configured_origins(api, origin, is_allowed):
    response = api.get("/api/makers/", HTTP_ORIGIN=origin)

    assert response.status_code == 200
    if is_allowed:
        assert response.headers["Access-Control-Allow-Origin"] == origin
    else:
        assert "Access-Control-Allow-Origin" not in response.headers
