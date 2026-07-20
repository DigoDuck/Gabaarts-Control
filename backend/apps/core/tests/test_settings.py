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


def test_static_files_are_collected_to_a_project_directory():
    assert STATIC_ROOT == BASE_DIR / "staticfiles"
    assert STATIC_URL == "/static/"
    assert STATIC_ROOT.is_dir()


def test_whitenoise_runs_before_session_middleware():
    assert MIDDLEWARE.index("whitenoise.middleware.WhiteNoiseMiddleware") < MIDDLEWARE.index(
        "django.contrib.sessions.middleware.SessionMiddleware"
    )


def test_railway_config_starts_gunicorn_and_runs_migrations():
    config = json.loads((BASE_DIR / "railway.json").read_text(encoding="utf-8"))

    assert config["build"]["builder"] == "DOCKERFILE"
    assert config["deploy"]["startCommand"] == "gunicorn config.wsgi --bind 0.0.0.0:$PORT"
    assert config["deploy"]["preDeployCommand"] == "python manage.py migrate"
