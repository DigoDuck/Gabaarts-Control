from decimal import Decimal

import pytest

from apps.core.models import Maker, Product

pytestmark = pytest.mark.django_db


def test_preview_da_caneca_bate_com_a_planilha(api):
    response = api.post(
        "/api/products/preview/",
        {
            "name": "Caneca",
            "material_cost": "10.49",
            "packaging_cost": "3.00",
            "production_time_min": 10,
            "maker": Maker.objects.get(name="Filha").pk,
            "target_margin_pct": "0.5000",
        },
        format="json",
    )
    assert response.status_code == 200, response.content
    body = response.json()
    assert body["cogs"] == {
        "material": "10.49",
        "labor": "1.67",
        "packaging": "3.00",
        "total": "15.16",
    }
    assert body["suggested_price"] == "30.31"


def test_preview_nao_cria_produto(api):
    response = api.post("/api/products/preview/", {"name": "Rascunho"}, format="json")
    assert response.status_code == 200, response.content
    assert Product.objects.count() == 0


def test_preview_de_kit_soma_os_componentes_do_payload(api):
    caneca = Product.objects.create(
        name="Caneca",
        material_cost=Decimal("10.49"),
        packaging_cost=Decimal("3.00"),
        production_time_min=10,
        maker=Maker.objects.get(name="Filha"),
    )
    chaveiro = Product.objects.create(name="Chaveiro", material_cost=Decimal("2.50"))

    response = api.post(
        "/api/products/preview/",
        {
            "name": "Kit",
            "is_combo": True,
            "packaging_cost": "1.00",
            "combo_items": [
                {"component": caneca.pk, "qty": 1},
                {"component": chaveiro.pk, "qty": 1},
            ],
        },
        format="json",
    )

    assert response.status_code == 200, response.content
    assert response.json()["cogs"]["total"] == "18.66"


def test_preview_aceita_rascunho_incompleto(api):
    # tempo de produção sem artesã derruba o POST real, mas não pode
    # derrubar o preview: a usuária ainda está preenchendo o formulário
    response = api.post(
        "/api/products/preview/", {"production_time_min": 10}, format="json"
    )
    assert response.status_code == 200, response.content
    assert response.json()["cogs"]["total"] == "0.00"


def test_preview_rejeita_valor_nao_numerico(api):
    response = api.post(
        "/api/products/preview/", {"material_cost": "dez reais"}, format="json"
    )
    assert response.status_code == 400
    assert "material_cost" in response.json()
