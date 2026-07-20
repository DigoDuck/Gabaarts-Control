from decimal import Decimal

import pytest

from apps.core.models import Channel, Maker, Product

pytestmark = pytest.mark.django_db


@pytest.fixture
def caneca():
    return Product.objects.create(
        name="Caneca",
        material_cost=Decimal("10.49"),
        packaging_cost=Decimal("3.00"),
        production_time_min=10,
        maker=Maker.objects.get(name="Filha"),
        target_margin_pct=Decimal("0.5000"),
    )


@pytest.fixture
def cogs_redondo():
    """Produto com COGS exatamente 30,00: isola o solver do arredondamento."""
    return Product.objects.create(name="COGS 30", material_cost=Decimal("30.00"))


def test_simula_caneca_na_shopee(api, caneca):
    response = api.post(
        "/api/pricing/simulate/",
        {
            "product": caneca.pk,
            "channel": Channel.objects.get(slug="shopee").pk,
            "price": "40.00",
        },
        format="json",
    )
    assert response.status_code == 200, response.content
    body = response.json()
    assert body["cogs"] == "15.16"
    assert body["fee"] == "12.00"
    assert body["profit"] == "12.84"
    # fração de 4 casas: 12,8433.../40 = 0,321083... → 0,3211
    assert body["margin_pct"] == "0.3211"
    assert body["status"] == "abaixo da meta"


def test_preco_alvo_cai_na_faixa_e_avisa_zona_morta(api, cogs_redondo):
    response = api.post(
        "/api/pricing/target-price/",
        {
            "product": cogs_redondo.pk,
            "channel": Channel.objects.get(slug="shopee").pk,
            "margin": "0.3700",
        },
        format="json",
    )
    assert response.status_code == 200, response.content
    body = response.json()
    assert body["price"] == "79.07"
    assert body["tier"]["min_price"] == "8.00"
    assert any("88.36" in aviso for aviso in body["warnings"])


def test_margem_inatingivel(api, cogs_redondo):
    response = api.post(
        "/api/pricing/target-price/",
        {
            "product": cogs_redondo.pk,
            "channel": Channel.objects.get(slug="shopee").pk,
            "margin": "0.9000",
        },
        format="json",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["price"] is None
    assert body["warnings"] == ["Margem inatingível neste canal."]


def test_preco_zero_na_simulacao_e_rejeitado(api, caneca):
    response = api.post(
        "/api/pricing/simulate/",
        {
            "product": caneca.pk,
            "channel": Channel.objects.get(slug="shopee").pk,
            "price": "0.00",
        },
        format="json",
    )
    assert response.status_code == 400


def test_margem_de_100_pct_e_rejeitada(api, cogs_redondo):
    response = api.post(
        "/api/pricing/target-price/",
        {
            "product": cogs_redondo.pk,
            "channel": Channel.objects.get(slug="shopee").pk,
            "margin": "1.0000",
        },
        format="json",
    )
    assert response.status_code == 400


def test_precificacao_exige_autenticacao(anon, caneca):
    response = anon.post(
        "/api/pricing/simulate/",
        {"product": caneca.pk, "channel": 1, "price": "40.00"},
        format="json",
    )
    assert response.status_code == 401
