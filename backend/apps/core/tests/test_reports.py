from datetime import date
from decimal import Decimal

import pytest

from apps.core.models import Channel, Product, Sale, SaleItem
from apps.core.services.reports import sales_summary

pytestmark = pytest.mark.django_db


@pytest.fixture
def vendas():
    insta = Channel.objects.get(slug="instagram")
    shopee = Channel.objects.get(slug="shopee")
    caneca = Product.objects.create(name="Caneca", material_cost=Decimal("10.49"))
    s1 = Sale.objects.create(date=date(2026, 7, 10), channel=insta,
                             status=Sale.Status.COMPLETED)
    SaleItem.objects.create(sale=s1, product=caneca, qty=2, unit_price=Decimal("30.00"),
                            unit_cogs=Decimal("15.16"), unit_fee=Decimal("0"),
                            unit_freight=Decimal("0"))
    s2 = Sale.objects.create(date=date(2026, 7, 12), channel=shopee,
                             status=Sale.Status.COMPLETED)
    SaleItem.objects.create(sale=s2, product=caneca, qty=1, unit_price=Decimal("40.00"),
                            unit_cogs=Decimal("15.16"), unit_fee=Decimal("12.00"),
                            unit_freight=Decimal("2.00"))
    # pendente: fora do resumo
    s3 = Sale.objects.create(date=date(2026, 7, 13), channel=insta,
                             status=Sale.Status.PENDING)
    SaleItem.objects.create(sale=s3, product=caneca, qty=5, unit_price=Decimal("30.00"),
                            unit_cogs=Decimal("15.16"), unit_fee=Decimal("0"),
                            unit_freight=Decimal("0"))


def test_resumo_considera_so_concluidas(vendas):
    resumo = sales_summary(date(2026, 7, 1), date(2026, 7, 31))
    assert resumo["revenue"] == Decimal("100.00")   # 2×30 + 1×40
    assert resumo["profit"] == Decimal("40.52")     # 2×14,84 + 1×10,84
    assert resumo["sales_count"] == 2
    assert resumo["avg_ticket"] == Decimal("50.00")


def test_quebra_por_canal(vendas):
    resumo = sales_summary(date(2026, 7, 1), date(2026, 7, 31))
    canais = {linha["channel_name"]: linha for linha in resumo["by_channel"]}
    assert canais["Instagram"]["revenue"] == Decimal("60.00")
    assert canais["Shopee"]["profit"] == Decimal("10.84")


def test_filtro_por_canal(vendas):
    shopee = Channel.objects.get(slug="shopee")
    resumo = sales_summary(date(2026, 7, 1), date(2026, 7, 31), channel=shopee)
    assert resumo["revenue"] == Decimal("40.00")
    assert resumo["sales_count"] == 1


def test_ticket_medio_arredonda_meio_centavo():
    insta = Channel.objects.get(slug="instagram")
    caneca = Product.objects.create(name="Caneca", material_cost=Decimal("10.49"))
    for preco in (Decimal("10.00"), Decimal("10.01")):
        sale = Sale.objects.create(date=date(2026, 7, 15), channel=insta,
                                   status=Sale.Status.COMPLETED)
        SaleItem.objects.create(sale=sale, product=caneca, qty=1, unit_price=preco,
                                unit_cogs=Decimal("5.00"), unit_fee=Decimal("0"),
                                unit_freight=Decimal("0"))
    resumo = sales_summary(date(2026, 7, 1), date(2026, 7, 31))
    assert resumo["avg_ticket"] == Decimal("10.01")  # 20,01 / 2 = 10,005 → HALF_UP
