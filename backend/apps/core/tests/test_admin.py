from decimal import Decimal

import pytest

from apps.core.models import Channel, Maker, Product, Sale, SaleItem
from apps.core.services.sales import refresh_snapshots

pytestmark = pytest.mark.django_db

PAGES = ["maker", "product", "channel", "sale", "equipment"]


def test_changelists_abrem(admin_client):
    for page in PAGES:
        assert admin_client.get(f"/admin/core/{page}/").status_code == 200


def test_add_forms_abrem(admin_client):
    for page in PAGES:
        assert admin_client.get(f"/admin/core/{page}/add/").status_code == 200


def test_criar_venda_pelo_admin_congela_snapshot(admin_client):
    filha = Maker.objects.get(name="Filha")
    caneca = Product.objects.create(
        name="Caneca", material_cost=Decimal("10.49"), production_time_min=10,
        maker=filha, packaging_cost=Decimal("3.00"),
    )
    shopee = Channel.objects.get(slug="shopee")
    data = {
        "date": "18/07/2026",
        "channel": str(shopee.pk),
        "customer_name": "",
        "status": "completed",
        "items-TOTAL_FORMS": "1",
        "items-INITIAL_FORMS": "0",
        "items-MIN_NUM_FORMS": "0",
        "items-MAX_NUM_FORMS": "1000",
        "items-0-product": str(caneca.pk),
        "items-0-qty": "1",
        "items-0-unit_price": "40.00",
        "items-0-unit_freight": "",
    }
    resp = admin_client.post("/admin/core/sale/add/", data)
    assert resp.status_code == 302  # 200 = formulário voltou com erro de validação
    item = Sale.objects.get().items.get()
    assert item.unit_cogs == Decimal("15.16")
    assert item.unit_fee == Decimal("12.00")


def test_admin_nao_reescreve_snapshot_em_edicao_sem_efeito_no_calculo(admin_client):
    """Salvar a venda no Admin sem mexer em canal nem itens preserva o congelado."""
    maker = Maker.objects.get(name="Filha")
    produto = Product.objects.create(
        name="Caneca",
        material_cost=Decimal("10.49"),
        packaging_cost=Decimal("3.00"),
        production_time_min=10,
        maker=maker,
    )
    canal = Channel.objects.get(slug="whatsapp")
    venda = Sale.objects.create(date="2026-07-10", channel=canal, customer_name="Cliente")
    item = SaleItem.objects.create(
        sale=venda, product=produto, qty=1, unit_price=Decimal("40.00")
    )
    refresh_snapshots(venda)
    item.refresh_from_db()
    assert item.unit_cogs == Decimal("15.16")

    # parâmetro muda DEPOIS da venda: não pode vazar para o passado
    maker.hourly_rate = Decimal("50.00")
    maker.save()

    response = admin_client.post(
        f"/admin/core/sale/{venda.pk}/change/",
        {
            "date": "2026-07-10",
            "channel": canal.pk,
            "customer_name": "Romilda",
            "status": "completed",
            "items-TOTAL_FORMS": "1",
            "items-INITIAL_FORMS": "1",
            "items-MIN_NUM_FORMS": "0",
            "items-MAX_NUM_FORMS": "1000",
            "items-0-id": str(item.pk),
            "items-0-sale": str(venda.pk),
            "items-0-product": str(produto.pk),
            "items-0-qty": "1",
            "items-0-unit_price": "40.00",
            "items-0-unit_freight": "0.00",
        },
        follow=True,
    )

    assert response.status_code == 200
    item.refresh_from_db()
    assert item.unit_cogs == Decimal("15.16")
