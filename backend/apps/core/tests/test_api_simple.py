from decimal import Decimal

import pytest

from apps.core.models import Equipment, Maker

pytestmark = pytest.mark.django_db


def test_lista_artesas_do_seed(api):
    nomes = {maker["name"] for maker in api.get("/api/makers/").json()}
    assert nomes == {"Rouseli", "Filha"}


def test_cria_artesa(api):
    response = api.post("/api/makers/", {"name": "Nova", "hourly_rate": "15.00"})
    assert response.status_code == 201
    assert Maker.objects.get(name="Nova").hourly_rate == Decimal("15.00")


def test_dinheiro_sai_como_string_nunca_float(api):
    body = api.get("/api/makers/").json()
    assert all(isinstance(maker["hourly_rate"], str) for maker in body)


def test_atualiza_artesa(api):
    maker = Maker.objects.get(name="Rouseli")
    response = api.patch(
        f"/api/makers/{maker.pk}/", {"hourly_rate": "13.00"}, format="json"
    )
    assert response.status_code == 200
    maker.refresh_from_db()
    assert maker.hourly_rate == Decimal("13.00")


def test_crud_de_equipamento(api):
    response = api.post(
        "/api/equipment/",
        {"name": "Prensa de caneca", "category": "Prensa", "value": "550.00"},
    )
    assert response.status_code == 201
    pk = response.json()["id"]
    assert api.delete(f"/api/equipment/{pk}/").status_code == 204
    assert not Equipment.objects.filter(pk=pk).exists()
