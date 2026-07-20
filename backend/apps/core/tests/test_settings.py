import importlib
import json

from config.settings.base import (
    BASE_DIR,
    MIDDLEWARE,
    STATIC_ROOT,
    STATIC_URL,
    database_config,
)


def test_database_url_takes_precedence_over_postgres_variables(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://railway:secret@db.railway.internal:5432/railway",
    )

    config = database_config()

    assert config["ENGINE"] == "django.db.backends.postgresql"
    assert config["NAME"] == "railway"
    assert config["USER"] == "railway"
    assert config["PASSWORD"] == "secret"
    assert config["HOST"] == "db.railway.internal"
    assert config["PORT"] == 5432


def test_database_config_falls_back_to_existing_postgres_variables(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("POSTGRES_DB", "gabaarts_test")
    monkeypatch.setenv("POSTGRES_USER", "gabaarts_user")
    monkeypatch.setenv("POSTGRES_PASSWORD", "password")
    monkeypatch.setenv("POSTGRES_HOST", "db")
    monkeypatch.setenv("POSTGRES_PORT", "5433")

    config = database_config()

    assert config == {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "gabaarts_test",
        "USER": "gabaarts_user",
        "PASSWORD": "password",
        "HOST": "db",
        "PORT": "5433",
    }


def test_static_root_is_the_committed_staticfiles_dir():
    assert STATIC_ROOT == BASE_DIR / "staticfiles"
    assert STATIC_URL == "/static/"
    assert STATIC_ROOT.is_dir()


def test_cors_and_whitenoise_run_before_session_middleware():
    assert MIDDLEWARE.index("corsheaders.middleware.CorsMiddleware") < MIDDLEWARE.index(
        "whitenoise.middleware.WhiteNoiseMiddleware"
    )
    assert MIDDLEWARE.index("whitenoise.middleware.WhiteNoiseMiddleware") < MIDDLEWARE.index(
        "django.contrib.sessions.middleware.SessionMiddleware"
    )


def test_railway_deploy_runs_migrations_and_has_no_healthcheck():
    config = json.loads((BASE_DIR / "railway.json").read_text(encoding="utf-8"))

    assert "migrate" in config["deploy"]["preDeployCommand"]
    assert "healthcheckPath" not in config["deploy"]


def test_prod_settings_enable_the_full_hardening(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-only-secret")
    monkeypatch.setenv("ALLOWED_HOSTS", "example.up.railway.app,other.example")
    monkeypatch.setenv("CSRF_TRUSTED_ORIGINS", "https://example.up.railway.app")

    from config.settings import prod

    prod = importlib.reload(prod)

    assert prod.DEBUG is False
    assert prod.SECRET_KEY == "test-only-secret"
    assert prod.ALLOWED_HOSTS == ["example.up.railway.app", "other.example"]
    assert prod.CSRF_TRUSTED_ORIGINS == ["https://example.up.railway.app"]
    assert prod.SECURE_SSL_REDIRECT is True
    assert prod.SECURE_HSTS_SECONDS == 31_536_000
    assert prod.SESSION_COOKIE_SECURE is True
    assert prod.CSRF_COOKIE_SECURE is True
    assert prod.SECURE_PROXY_SSL_HEADER == ("HTTP_X_FORWARDED_PROTO", "https")
