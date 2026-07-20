from datetime import date
from decimal import Decimal

import pytest

from apps.core.models import Channel, Product, Sale, SaleItem

pytestmark = pytest.mark.django_db


@pytest.fixture
def vendas():
    """Mesmo cenário do relatório da fase 1: receita 100,00 e lucro 40,52."""
    insta = Channel.objects.get(slug="instagram")
    shopee = Channel.objects.get(slug="shopee")
    caneca = Product.objects.create(name="Caneca", material_cost=Decimal("10.49"))

    s1 = Sale.objects.create(
        date=date(2026, 7, 10), channel=insta, status=Sale.Status.COMPLETED
    )
    SaleItem.objects.create(
        sale=s1,
        product=caneca,
        qty=2,
        unit_price=Decimal("30.00"),
        unit_cogs=Decimal("15.16"),
        unit_fee=Decimal("0"),
        unit_freight=Decimal("0"),
    )
    s2 = Sale.objects.create(
        date=date(2026, 7, 12), channel=shopee, status=Sale.Status.COMPLETED
    )
    SaleItem.objects.create(
        sale=s2,
        product=caneca,
        qty=1,
        unit_price=Decimal("40.00"),
        unit_cogs=Decimal("15.16"),
        unit_fee=Decimal("12.00"),
        unit_freight=Decimal("2.00"),
    )
    # pendente fica fora do resumo
    s3 = Sale.objects.create(
        date=date(2026, 7, 13), channel=insta, status=Sale.Status.PENDING
    )
    SaleItem.objects.create(
        sale=s3,
        product=caneca,
        qty=5,
        unit_price=Decimal("30.00"),
        unit_cogs=Decimal("15.16"),
        unit_fee=Decimal("0"),
        unit_freight=Decimal("0"),
    )


def test_resumo_do_periodo(api, vendas):
    body = api.get("/api/reports/summary/?from=2026-07-01&to=2026-07-31").json()
    assert Decimal(body["revenue"]) == Decimal("100.00")
    assert Decimal(body["profit"]) == Decimal("40.52")
    assert body["sales_count"] == 2
    assert Decimal(body["avg_ticket"]) == Decimal("50.00")


def test_quebra_por_canal(api, vendas):
    body = api.get("/api/reports/summary/?from=2026-07-01&to=2026-07-31").json()
    por_canal = {linha["channel_name"]: linha for linha in body["by_channel"]}
    assert Decimal(por_canal["Instagram"]["revenue"]) == Decimal("60.00")
    assert Decimal(por_canal["Shopee"]["revenue"]) == Decimal("40.00")


def test_filtro_por_canal(api, vendas):
    shopee = Channel.objects.get(slug="shopee").pk
    body = api.get(
        f"/api/reports/summary/?from=2026-07-01&to=2026-07-31&channel={shopee}"
    ).json()
    assert Decimal(body["revenue"]) == Decimal("40.00")
    assert body["sales_count"] == 1


def test_periodo_sem_vendas_devolve_zeros(api, vendas):
    body = api.get("/api/reports/summary/?from=2026-01-01&to=2026-01-31").json()
    assert Decimal(body["revenue"]) == Decimal("0")
    assert body["sales_count"] == 0
    assert body["by_channel"] == []


def test_periodo_obrigatorio(api):
    response = api.get("/api/reports/summary/")
    assert response.status_code == 400
    assert "from" in response.json()


def test_dinheiro_sai_como_string(api, vendas):
    body = api.get("/api/reports/summary/?from=2026-07-01&to=2026-07-31").json()
    assert isinstance(body["revenue"], str)
    assert isinstance(body["by_channel"][0]["revenue"], str)
