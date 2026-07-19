from decimal import Decimal

import pytest

from apps.core.models import Channel, Maker

pytestmark = pytest.mark.django_db


def test_makers_seedadas():  # custo/hora oficial: arquitetura §0.2 / decisão A1
    assert Maker.objects.get(name="Rouseli").hourly_rate == Decimal("12.00")
    assert Maker.objects.get(name="Filha").hourly_rate == Decimal("10.00")


def test_canais_ativos():  # ML e TikTok ficam FORA do seed (decisões A2/A3)
    assert set(Channel.objects.values_list("slug", flat=True)) == {
        "instagram", "whatsapp", "shopee", "site"
    }


def test_faixas_da_shopee():  # tabela vigente 03/2026, arquitetura §2.1
    shopee = Channel.objects.get(slug="shopee")
    faixas = list(
        shopee.fee_tiers.order_by("min_price")
        .values_list("min_price", "commission_pct", "fixed_fee")
    )
    assert faixas == [
        (Decimal("0.00"), Decimal("0.5000"), Decimal("0.00")),
        (Decimal("8.00"), Decimal("0.2000"), Decimal("4.00")),
        (Decimal("80.00"), Decimal("0.1400"), Decimal("16.00")),
        (Decimal("100.00"), Decimal("0.1400"), Decimal("20.00")),
        (Decimal("200.00"), Decimal("0.1400"), Decimal("26.00")),
    ]
