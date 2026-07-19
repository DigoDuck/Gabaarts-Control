from decimal import Decimal

import pytest

from apps.core.models import Channel
from apps.core.services.costing import q2
from apps.core.services.fees import channel_fee

pytestmark = pytest.mark.django_db  # usa o seed da 0002


def shopee():
    return Channel.objects.get(slug="shopee")


def test_taxa_shopee_a_40():  # planilha §0.2: faixa 8–80 = 20% + 4 → R$ 12,00
    assert channel_fee(shopee(), Decimal("40.00"))["total"] == Decimal("12.00")


def test_faixa_de_50_pct_abaixo_de_8():
    assert q2(channel_fee(shopee(), Decimal("7.99"))["total"]) == Decimal("4.00")


def test_fronteiras_das_faixas():  # min_price pertence à faixa de cima
    assert channel_fee(shopee(), Decimal("8.00"))["total"] == Decimal("5.60")
    assert channel_fee(shopee(), Decimal("80.00"))["total"] == Decimal("27.20")
    assert channel_fee(shopee(), Decimal("100.00"))["total"] == Decimal("34.00")
    assert channel_fee(shopee(), Decimal("200.00"))["total"] == Decimal("54.00")


def test_canais_diretos_taxa_zero():  # decisão B9
    for slug in ("instagram", "whatsapp"):
        canal = Channel.objects.get(slug=slug)
        assert channel_fee(canal, Decimal("100.00"))["total"] == Decimal("0")


def test_site_gateway_5_pct():  # provisório, arquitetura §6
    site = Channel.objects.get(slug="site")
    assert channel_fee(site, Decimal("40.00"))["total"] == Decimal("2.00")
