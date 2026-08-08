from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.core.models import Channel, Maker, Product, Sale, SaleItem
from apps.core.services import sales as sales_service
from apps.core.services.sales import calculate_sale, refresh_snapshots, snapshot_result


pytestmark = pytest.mark.django_db


@pytest.fixture
def order():
    maker = Maker.objects.get(name="Filha")
    mug = Product.objects.create(
        name="Caneca",
        material_cost=Decimal("10.49"),
        packaging_cost=Decimal("3.00"),
        production_time_min=10,
        maker=maker,
        base_price=Decimal("40.00"),
        target_margin_pct=Decimal("0.50"),
    )
    keychain = Product.objects.create(
        name="Chaveiro",
        material_cost=Decimal("2.50"),
        packaging_cost=Decimal("3.00"),
        production_time_min=5,
        maker=Maker.objects.get(name="Rouseli"),
        base_price=Decimal("20.00"),
        target_margin_pct=Decimal("0.40"),
    )
    sale = Sale.objects.create(
        date=date(2026, 8, 8),
        channel=Channel.objects.get(slug="shopee"),
        products_total=Decimal("72.00"),
    )
    SaleItem.objects.create(sale=sale, product=mug, qty=1)
    SaleItem.objects.create(sale=sale, product=keychain, qty=2)
    return sale


def test_calculo_distribui_total_pelo_preco_base_e_aplica_taxa_por_unidade(order):
    result = calculate_sale(order.channel, order.products_total, order.items.all())

    # pesos 40 + 20×2: preços estimados 36 e 18 por unidade.
    # Shopee: 20% + 4 → 11,20 + 7,60×2 = 26,40.
    assert result["suggested_channel_fee"] == Decimal("26.40")
    assert result["applied_channel_fee"] == Decimal("26.40")
    assert result["fee_source"] == Sale.FeeSource.SUGGESTED
    assert result["total_cogs"] == Decimal("28.16")
    assert result["profit"] == Decimal("17.44")


def test_taxa_manual_substitui_aplicada_mas_preserva_sugestao(order):
    result = calculate_sale(
        order.channel,
        order.products_total,
        order.items.all(),
        fee_override=Decimal("29.90"),
    )

    assert result["suggested_channel_fee"] == Decimal("26.40")
    assert result["applied_channel_fee"] == Decimal("29.90")
    assert result["fee_source"] == Sale.FeeSource.MANUAL
    assert any("taxa informada" in warning.lower() for warning in result["warnings"])


def test_frete_muda_total_pago_sem_mudar_lucro(order):
    without_shipping = calculate_sale(order.channel, order.products_total, order.items.all())
    with_shipping = calculate_sale(
        order.channel,
        order.products_total,
        order.items.all(),
        shipping_amount=Decimal("15.00"),
    )

    assert with_shipping["profit"] == without_shipping["profit"]
    assert with_shipping["amount_paid"] == Decimal("87.00")


def test_meta_do_pedido_e_ponderada_pelos_precos_base(order):
    result = calculate_sale(order.channel, order.products_total, order.items.all())

    # (40×50% + 40×40%) / 80 = 45%.
    assert result["target_margin_pct"] == Decimal("0.4500")
    assert result["margin_pct"] == Decimal("0.2422")
    assert any("margem abaixo" in warning.lower() for warning in result["warnings"])


def test_total_20_porcento_abaixo_do_preco_base_nao_avisa_no_limite(order):
    result = calculate_sale(order.channel, Decimal("64.00"), order.items.all())
    assert not any("preços-base" in warning for warning in result["warnings"])


def test_total_mais_de_20_porcento_abaixo_do_preco_base_avisa(order):
    result = calculate_sale(order.channel, Decimal("63.99"), order.items.all())
    assert any("preços-base" in warning for warning in result["warnings"])


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("products_total", Decimal("0")),
        ("shipping_amount", Decimal("-0.01")),
        ("fee_override", Decimal("-0.01")),
    ],
)
def test_calculo_rejeita_valor_financeiro_invalido(order, field, value):
    kwargs = {
        "channel": order.channel,
        "products_total": order.products_total,
        "items": order.items.all(),
        "shipping_amount": Decimal("0"),
        "fee_override": None,
    }
    kwargs[field] = value

    with pytest.raises(ValidationError):
        calculate_sale(**kwargs)


def test_calculo_rejeita_produto_inativo(order):
    item = order.items.first()
    item.product.is_active = False
    item.product.save(update_fields=["is_active"])

    with pytest.raises(ValidationError):
        calculate_sale(order.channel, order.products_total, order.items.all())


def test_calculo_rejeita_produto_sem_preco_base(order):
    item = order.items.first()
    item.product.base_price = None
    item.product.save(update_fields=["base_price"])

    with pytest.raises(ValidationError):
        calculate_sale(order.channel, order.products_total, order.items.all())


def test_refresh_congela_o_mesmo_resultado_do_preview(order):
    preview = calculate_sale(order.channel, order.products_total, order.items.all())
    frozen = refresh_snapshots(order)
    order.refresh_from_db()

    assert order.channel_fee == preview["applied_channel_fee"]
    assert order.fee_source == Sale.FeeSource.SUGGESTED
    assert frozen["profit"] == preview["profit"]
    assert [item.unit_cogs for item in order.items.order_by("id")] == [
        Decimal("15.16"),
        Decimal("6.50"),
    ]


def test_snapshot_result_preserva_frete_historico_e_ignora_frete_cobrado(order):
    refresh_snapshots(order)
    order.shipping_amount = Decimal("15.00")
    order.legacy_freight_cost = Decimal("2.00")
    order.save(update_fields=["shipping_amount", "legacy_freight_cost"])

    result = snapshot_result(order)

    assert result["profit"] == Decimal("15.44")
    assert result["amount_paid"] == Decimal("87.00")


def test_refresh_le_as_faixas_do_canal_uma_vez(order):
    with CaptureQueriesContext(connection) as queries:
        refresh_snapshots(order)

    tier_reads = [
        query
        for query in queries.captured_queries
        if "channelfeetier" in query["sql"].lower()
        and query["sql"].lower().startswith("select")
    ]
    assert len(tier_reads) == 1, [query["sql"] for query in tier_reads]


def test_refresh_e_atomico(order, monkeypatch):
    first = order.items.order_by("id").first()
    real_bulk_update = sales_service.SaleItem.objects.bulk_update

    def explode(*args, **kwargs):
        real_bulk_update(*args, **kwargs)
        raise RuntimeError("falha simulada")

    monkeypatch.setattr(sales_service.SaleItem.objects, "bulk_update", explode)

    with pytest.raises(RuntimeError):
        refresh_snapshots(order)

    first.refresh_from_db()
    order.refresh_from_db()
    assert first.unit_cogs == Decimal("0")
    assert order.channel_fee == Decimal("0")
