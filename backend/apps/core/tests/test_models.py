from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.core.models import Channel, ChannelFeeTier, ComboItem, Product, Sale, SaleItem

pytestmark = pytest.mark.django_db


def canal():
    # canal seedado pela migration 0002_seed
    return Channel.objects.get(slug="instagram")


def test_kit_dentro_de_kit_bloqueado():
    kit_a = Product.objects.create(name="Kit A", is_combo=True)
    kit_b = Product.objects.create(name="Kit B", is_combo=True)
    item = ComboItem(combo=kit_a, component=kit_b, qty=1)
    with pytest.raises(ValidationError):
        item.full_clean()


def test_componente_so_em_produto_kit():
    simples = Product.objects.create(name="Caneca")
    outro = Product.objects.create(name="Chaveiro")
    item = ComboItem(combo=simples, component=outro, qty=1)
    with pytest.raises(ValidationError):
        item.full_clean()


def test_produto_inativo_nao_vende():
    produto = Product.objects.create(name="Descontinuado", is_active=False)
    sale = Sale.objects.create(date=date(2026, 7, 18), channel=canal())
    item = SaleItem(sale=sale, product=produto, qty=1, unit_price=Decimal("10.00"))
    with pytest.raises(ValidationError):
        item.full_clean()


def test_preco_zero_bloqueado():
    produto = Product.objects.create(name="Caneca")
    sale = Sale.objects.create(date=date(2026, 7, 18), channel=canal())
    item = SaleItem(sale=sale, product=produto, qty=1, unit_price=Decimal("0"))
    with pytest.raises(ValidationError):
        item.full_clean()


def test_tempo_de_producao_exige_artesa():
    produto = Product(name="Caneca", production_time_min=10)
    with pytest.raises(ValidationError):
        produto.full_clean()


def test_componente_nao_pode_virar_kit():
    kit = Product.objects.create(name="Kit", is_combo=True)
    componente = Product.objects.create(name="Caneca")
    ComboItem.objects.create(combo=kit, component=componente, qty=1)
    componente.is_combo = True
    with pytest.raises(ValidationError):
        componente.full_clean()


def test_faixa_de_taxa_rejeita_valores_negativos():
    canal = Channel.objects.get(slug="instagram")
    faixa = ChannelFeeTier(channel=canal, min_price=Decimal("0"),
                           commission_pct=Decimal("-0.10"), fixed_fee=Decimal("-1.00"))
    with pytest.raises(ValidationError):
        faixa.full_clean()


def test_perda_acima_de_100pct_bloqueada():
    # 1,50 = 150% de perda; provável dedo gordo (0,50 digitado como 50 vira 5000%)
    produto = Product(name="Caneca", waste_pct=Decimal("1.5"))
    with pytest.raises(ValidationError):
        produto.full_clean()


def test_venda_guarda_fatos_financeiros_no_cabecalho():
    sale = Sale.objects.create(
        date=date(2026, 8, 8),
        channel=canal(),
        products_total=Decimal("100.00"),
        shipping_amount=Decimal("15.00"),
        channel_fee=Decimal("20.00"),
    )

    sale.refresh_from_db()
    assert sale.products_total == Decimal("100.00")
    assert sale.shipping_amount == Decimal("15.00")
    assert sale.channel_fee == Decimal("20.00")
    assert sale.fee_source == Sale.FeeSource.SUGGESTED
    assert sale.legacy_freight_cost == Decimal("0.00")


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("products_total", Decimal("0")),
        ("shipping_amount", Decimal("-0.01")),
        ("channel_fee", Decimal("-0.01")),
    ],
)
def test_venda_rejeita_valores_financeiros_invalidos(field, value):
    values = {
        "products_total": Decimal("10.00"),
        "shipping_amount": Decimal("0"),
        "channel_fee": Decimal("0"),
    }
    values[field] = value
    sale = Sale(date=date(2026, 8, 8), channel=canal(), **values)

    with pytest.raises(ValidationError) as error:
        sale.full_clean()

    assert field in error.value.message_dict
