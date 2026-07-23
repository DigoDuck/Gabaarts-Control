from decimal import Decimal

import pytest

from apps.core.models import ComboItem, Maker, Product

pytestmark = pytest.mark.django_db


@pytest.fixture
def caneca(api):
    """Caneca da planilha: COGS 15,16 e preço sugerido 30,31."""
    maker = Maker.objects.get(name="Filha")
    response = api.post(
        "/api/products/",
        {
            "name": "Caneca personalizada",
            "category": "gifts",
            "material_cost": "10.49",
            "packaging_cost": "3.00",
            "production_time_min": 10,
            "maker": maker.pk,
            "target_margin_pct": "0.5000",
        },
        format="json",
    )
    assert response.status_code == 201, response.content
    return response.json()


def test_produto_expoe_cogs_decomposto_e_preco_sugerido(caneca):
    assert caneca["cogs"] == {
        "material": "10.49",
        "labor": "1.67",
        "packaging": "3.00",
        "total": "15.16",
    }
    assert caneca["suggested_price"] == "30.31"


def test_tempo_de_producao_sem_artesa_e_rejeitado(api):
    response = api.post(
        "/api/products/",
        {"name": "Sem artesã", "production_time_min": 10},
        format="json",
    )
    assert response.status_code == 400
    assert "maker" in response.json()


def test_cria_kit_com_componentes(api, caneca):
    keychain = Product.objects.create(name="Chaveiro", material_cost=Decimal("2.50"))
    response = api.post(
        "/api/products/",
        {
            "name": "Kit caneca + chaveiro",
            "is_combo": True,
            "packaging_cost": "1.00",
            "combo_items": [
                {"component": caneca["id"], "qty": 1},
                {"component": keychain.pk, "qty": 1},
            ],
        },
        format="json",
    )
    assert response.status_code == 201, response.content
    body = response.json()
    assert {component["component_name"] for component in body["combo_items"]} == {
        "Caneca personalizada",
        "Chaveiro",
    }
    assert body["cogs"]["total"] == "18.66"


def test_componentes_em_produto_que_nao_e_kit_sao_rejeitados(api, caneca):
    response = api.post(
        "/api/products/",
        {
            "name": "Não é kit",
            "is_combo": False,
            "combo_items": [{"component": caneca["id"], "qty": 1}],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "combo_items" in response.json()


def test_kit_dentro_de_kit_e_rejeitado(api):
    internal_combo = Product.objects.create(name="Kit interno", is_combo=True)
    response = api.post(
        "/api/products/",
        {
            "name": "Kit externo",
            "is_combo": True,
            "combo_items": [{"component": internal_combo.pk, "qty": 1}],
        },
        format="json",
    )
    assert response.status_code == 400


def test_update_substitui_os_componentes(api, caneca):
    keychain = Product.objects.create(name="Chaveiro", material_cost=Decimal("2.50"))
    magnet = Product.objects.create(name="Ímã", material_cost=Decimal("2.70"))
    combo = api.post(
        "/api/products/",
        {
            "name": "Kit",
            "is_combo": True,
            "combo_items": [
                {"component": caneca["id"], "qty": 1},
                {"component": keychain.pk, "qty": 1},
            ],
        },
        format="json",
    ).json()
    # substitui os dois por outros dois: kit continua com 2+ (arquitetura §1.4)
    response = api.patch(
        f"/api/products/{combo['id']}/",
        {
            "combo_items": [
                {"component": keychain.pk, "qty": 3},
                {"component": magnet.pk, "qty": 2},
            ]
        },
        format="json",
    )
    assert response.status_code == 200, response.content
    body = response.json()
    qtys = {item["component"]: item["qty"] for item in body["combo_items"]}
    assert qtys == {keychain.pk: 3, magnet.pk: 2}


def test_kit_com_um_componente_e_rejeitado(api, caneca):
    keychain = Product.objects.create(name="Chaveiro", material_cost=Decimal("2.50"))
    response = api.post(
        "/api/products/",
        {
            "name": "Kit magro",
            "is_combo": True,
            "combo_items": [{"component": keychain.pk, "qty": 1}],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "is_combo" in response.json()


def test_kit_sem_componentes_e_rejeitado(api):
    response = api.post(
        "/api/products/",
        {"name": "Kit vazio", "is_combo": True, "combo_items": []},
        format="json",
    )
    assert response.status_code == 400
    assert "is_combo" in response.json()


def test_margem_alvo_de_100_pct_e_rejeitada(api):
    response = api.post(
        "/api/products/",
        {"name": "Impossível", "target_margin_pct": "1.0000"},
        format="json",
    )
    assert response.status_code == 400


def test_kit_com_componentes_nao_pode_ser_convertido_em_produto_comum(api):
    component = Product.objects.create(name="Componente")
    combo = Product.objects.create(name="Kit", is_combo=True)
    ComboItem.objects.create(combo=combo, component=component)

    response = api.patch(
        f"/api/products/{combo.pk}/", {"is_combo": False}, format="json"
    )

    assert response.status_code == 400
    assert "is_combo" in response.json()
