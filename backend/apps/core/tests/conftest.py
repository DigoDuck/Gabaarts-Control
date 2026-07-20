import pytest
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient


@pytest.fixture
def api(db):
    """Client já autenticado por token: toda rota da API exige IsAuthenticated."""
    user = User.objects.create_user("rouseli", password="senha-de-teste")
    client = APIClient()
    token = Token.objects.create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return client


@pytest.fixture
def anon():
    """Client sem credencial, para provar que a API está fechada."""
    return APIClient()
