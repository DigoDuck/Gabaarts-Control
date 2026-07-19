from decimal import Decimal

import pytest

from apps.core.models import Channel, Maker, Product, Sale

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
