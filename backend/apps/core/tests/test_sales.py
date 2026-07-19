from datetime import date
from decimal import Decimal

import pytest

from apps.core.models import Channel, Maker, Product, Sale, SaleItem
from apps.core.services import sales as sales_service
from apps.core.services.sales import refresh_snapshots

pytestmark = pytest.mark.django_db


def nova_venda():
    filha = Maker.objects.get(name="Filha")
    caneca = Product.objects.create(
        name="Caneca", material_cost=Decimal("10.49"), production_time_min=10,
        maker=filha, packaging_cost=Decimal("3.00"),
    )
    sale = Sale.objects.create(date=date(2026, 7, 18),
                               channel=Channel.objects.get(slug="shopee"))
    item = SaleItem.objects.create(sale=sale, product=caneca, qty=1,
                                   unit_price=Decimal("40.00"))
    return sale, item, filha


def test_snapshot_congela_custo_taxa_frete():
    sale, item, _ = nova_venda()
    refresh_snapshots(sale)
    item.refresh_from_db()
    assert item.unit_cogs == Decimal("15.16")
    assert item.unit_fee == Decimal("12.00")
    assert item.unit_freight == Decimal("0.00")  # canal sem frete padrão → 0


def test_mudar_custo_hora_nao_reescreve_o_passado():  # bug nº 1 da planilha (§0.1)
    sale, item, filha = nova_venda()
    refresh_snapshots(sale)
    filha.hourly_rate = Decimal("50.00")
    filha.save()
    item.refresh_from_db()
    assert item.unit_cogs == Decimal("15.16")  # congelado


def test_editar_venda_recalcula_explicitamente():  # §1.3
    sale, item, filha = nova_venda()
    refresh_snapshots(sale)
    filha.hourly_rate = Decimal("22.00")
    filha.save()
    refresh_snapshots(sale)
    item.refresh_from_db()
    assert item.unit_cogs == Decimal("17.16")  # 10,49 + 10×22÷60 + 3,00 → 17,16


def test_frete_manual_nao_e_sobrescrito():  # decisão A5: frete é manual por item
    sale, item, _ = nova_venda()
    item.unit_freight = Decimal("7.50")
    item.save()
    refresh_snapshots(sale)
    item.refresh_from_db()
    assert item.unit_freight == Decimal("7.50")


def test_refresh_e_atomico(monkeypatch):
    sale, item, _ = nova_venda()
    SaleItem.objects.create(sale=sale, product=item.product, qty=1,
                            unit_price=Decimal("30.00"))
    chamadas = {"n": 0}
    taxa_real = sales_service.channel_fee

    def explode_na_segunda(channel, price):
        chamadas["n"] += 1
        if chamadas["n"] == 2:
            raise RuntimeError("falha simulada")
        return taxa_real(channel, price)

    monkeypatch.setattr(sales_service, "channel_fee", explode_na_segunda)
    with pytest.raises(RuntimeError):
        refresh_snapshots(sale)
    item.refresh_from_db()
    # rollback total: o primeiro item não pode ter ficado congelado pela metade
    assert item.unit_cogs == Decimal("0")
