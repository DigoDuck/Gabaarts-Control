from decimal import Decimal

import pytest

from apps.core.models import Channel, Maker, Product
from apps.core.services.costing import unit_cogs
from apps.core.services.pricing import simulate, suggested_price


def caneca_cogs():
    # precisão cheia (15,1566...), não o 15,16 exibido — ver Global Constraints
    caneca = Product(
        material_cost=Decimal("10.49"), production_time_min=10,
        maker=Maker(hourly_rate=Decimal("10.00")),
        packaging_cost=Decimal("3.00"), waste_pct=Decimal("0"), batch_size=1,
    )
    return unit_cogs(caneca)["total"]


def test_preco_sugerido_caneca():  # planilha §0.2: R$ 30,31 (nunca 30,32)
    assert suggested_price(caneca_cogs(), Decimal("0.5")) == Decimal("30.31")


@pytest.mark.django_db
def test_simulate_caneca_na_shopee():
    filha = Maker.objects.get(name="Filha")
    caneca = Product.objects.create(
        name="Caneca", material_cost=Decimal("10.49"), production_time_min=10,
        maker=filha, packaging_cost=Decimal("3.00"), target_margin_pct=Decimal("0.5"),
    )
    shopee = Channel.objects.get(slug="shopee")
    result = simulate(caneca, shopee, Decimal("40.00"))
    assert result["fee"] == Decimal("12.00")
    assert result["profit"] == Decimal("12.84")  # 40 − 15,1566... − 12 → 12,84
    assert result["status"] == "abaixo da meta"  # 32,1% < meta de 50%
