from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.core.models import Channel, Maker, Product


pytestmark = pytest.mark.django_db


@pytest.fixture
def mug():
    return Product.objects.create(
        name="Caneca",
        material_cost=Decimal("10.49"),
        packaging_cost=Decimal("3.00"),
        production_time_min=10,
        maker=Maker.objects.get(name="Filha"),
        base_price=Decimal("40.00"),
        target_margin_pct=Decimal("0.50"),
    )


@pytest.fixture
def sale_payload(mug):
    return {
        "date": "2026-08-08",
        "channel": Channel.objects.get(slug="shopee").pk,
        "customer_name": "Cliente",
        "status": "completed",
        "products_total": "80.00",
        "shipping_amount": "15.00",
        "fee_override": None,
        "items": [{"product": mug.pk, "qty": 2}],
    }


def test_preview_e_venda_criada_usam_o_mesmo_resultado(api, sale_payload):
    preview = api.post("/api/sales/preview/", sale_payload, format="json")
    created = api.post("/api/sales/", sale_payload, format="json")

    assert preview.status_code == 200, preview.content
    assert created.status_code == 201, created.content
    preview_body = preview.json()
    created_body = created.json()
    assert preview_body["total_cogs"] == created_body["total_cogs"] == "30.32"
    assert preview_body["applied_channel_fee"] == created_body["channel_fee"] == "24.00"
    assert preview_body["profit"] == created_body["profit"] == "25.68"
    assert preview_body["margin_pct"] == created_body["margin_pct"] == "0.3210"
    assert preview_body["amount_paid"] == created_body["amount_paid"] == "95.00"


def test_preview_nao_faz_uma_query_por_artesa(api, sale_payload, mug):
    """unit_cogs lê product.maker; o preview roda a cada 400ms de digitação."""
    outro = Product.objects.create(
        name="Chaveiro",
        material_cost=Decimal("2.50"),
        packaging_cost=Decimal("3.00"),
        production_time_min=5,
        maker=Maker.objects.get(name="Rouseli"),
        base_price=Decimal("20.00"),
    )
    sale_payload["items"].append({"product": outro.pk, "qty": 1})

    with CaptureQueriesContext(connection) as queries:
        response = api.post("/api/sales/preview/", sale_payload, format="json")

    assert response.status_code == 200, response.content
    # a artesã tem que vir no JOIN do produto, nunca num SELECT à parte
    maker_reads = [
        query for query in queries.captured_queries
        if 'FROM "core_maker"' in query["sql"]
    ]
    assert maker_reads == [], [query["sql"] for query in maker_reads]


def test_preview_com_taxa_real_identifica_origem_manual(api, sale_payload):
    sale_payload["fee_override"] = "20.00"
    response = api.post("/api/sales/preview/", sale_payload, format="json")

    assert response.status_code == 200, response.content
    assert response.json()["suggested_channel_fee"] == "24.00"
    assert response.json()["applied_channel_fee"] == "20.00"
    assert response.json()["fee_source"] == "manual"


def test_patch_administrativo_preserva_snapshot(api, sale_payload):
    sale = api.post("/api/sales/", sale_payload, format="json").json()
    maker = Maker.objects.get(name="Filha")
    maker.hourly_rate = Decimal("50.00")
    maker.save(update_fields=["hourly_rate"])

    response = api.patch(
        f"/api/sales/{sale['id']}/",
        {"customer_name": "Romilda"},
        format="json",
    )

    assert response.status_code == 200, response.content
    assert response.json()["total_cogs"] == "30.32"
    assert response.json()["channel_fee"] == "24.00"


def test_patch_apenas_do_frete_preserva_custo_e_taxa(api, sale_payload):
    sale = api.post("/api/sales/", sale_payload, format="json").json()
    response = api.patch(
        f"/api/sales/{sale['id']}/",
        {"shipping_amount": "25.00"},
        format="json",
    )

    assert response.status_code == 200, response.content
    assert response.json()["total_cogs"] == "30.32"
    assert response.json()["channel_fee"] == "24.00"
    assert response.json()["profit"] == "25.68"
    assert response.json()["amount_paid"] == "105.00"


def test_patch_financeiro_cria_novo_snapshot(api, sale_payload):
    sale = api.post("/api/sales/", sale_payload, format="json").json()
    maker = Maker.objects.get(name="Filha")
    maker.hourly_rate = Decimal("50.00")
    maker.save(update_fields=["hourly_rate"])

    response = api.patch(
        f"/api/sales/{sale['id']}/",
        {"products_total": "100.00"},
        format="json",
    )

    assert response.status_code == 200, response.content
    assert response.json()["total_cogs"] == "43.64"
    assert response.json()["channel_fee"] == "28.00"


def test_patch_remove_taxa_manual_volta_para_sugestao(api, sale_payload):
    sale_payload["fee_override"] = "20.00"
    sale = api.post("/api/sales/", sale_payload, format="json").json()

    response = api.patch(
        f"/api/sales/{sale['id']}/",
        {"fee_override": None},
        format="json",
    )

    assert response.status_code == 200, response.content
    assert response.json()["channel_fee"] == "24.00"
    assert response.json()["fee_source"] == "suggested"


@pytest.mark.parametrize(
    ("patch", "field"),
    [
        ({"products_total": "0.00"}, "products_total"),
        ({"shipping_amount": "-0.01"}, "shipping_amount"),
        ({"fee_override": "-0.01"}, "fee_override"),
        ({"items": []}, "items"),
    ],
)
def test_preview_rejeita_entradas_invalidas(api, sale_payload, patch, field):
    sale_payload.update(patch)
    response = api.post("/api/sales/preview/", sale_payload, format="json")

    assert response.status_code == 400
    assert field in response.json()


def test_preview_rejeita_produto_inativo(api, sale_payload, mug):
    mug.is_active = False
    mug.save(update_fields=["is_active"])

    response = api.post("/api/sales/preview/", sale_payload, format="json")

    assert response.status_code == 400
    # erro de item aninhado no DRF vem como lista posicional, não dict indexado
    assert "product" in response.json()["items"][0]
