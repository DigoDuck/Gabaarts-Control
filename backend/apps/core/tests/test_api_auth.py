import pytest
from django.contrib.auth.models import User

pytestmark = pytest.mark.django_db


def test_obtem_token_com_credencial_valida(anon):
    User.objects.create_user("rouseli", password="senha-de-teste")
    response = anon.post(
        "/api/auth/token/", {"username": "rouseli", "password": "senha-de-teste"}
    )
    assert response.status_code == 200
    assert response.json()["token"]


def test_credencial_errada_nao_gera_token(anon):
    User.objects.create_user("rouseli", password="senha-de-teste")
    response = anon.post(
        "/api/auth/token/", {"username": "rouseli", "password": "errada"}
    )
    assert response.status_code == 400


def test_api_fechada_para_anonimo(anon):
    assert anon.get("/api/").status_code == 401


def test_token_valido_abre_a_api(api):
    assert api.get("/api/").status_code == 200
