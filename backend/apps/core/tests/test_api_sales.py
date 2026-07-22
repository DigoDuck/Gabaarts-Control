from decimal import Decimal

import pytest

from apps.core.models import Channel, Maker, Product

pytestmark = pytest.mark.django_db


@pytest.fixture
def caneca():
    return Product.objects.create(
        name="Caneca",
        material_cost=Decimal("10.49"),
        packaging_cost=Decimal("3.00"),
        production_time_min=10,
        maker=Maker.objects.get(name="Filha"),
    )


def nova_venda(api, caneca, slug="shopee", price="40.00", qty=1, dia="2026-07-10"):
    return api.post(
        "/api/sales/",
        {
            "date": dia,
            "channel": Channel.objects.get(slug=slug).pk,
            "customer_name": "Cliente",
            "status": "completed",
            "items": [{"product": caneca.pk, "qty": qty, "unit_price": price}],
        },
        format="json",
    )


def test_criar_venda_congela_snapshot(api, caneca):
    response = nova_venda(api, caneca)
    assert response.status_code == 201, response.content
    item = response.json()["items"][0]
    assert item["unit_cogs"] == "15.16"
    assert item["unit_fee"] == "12.00"
    assert item["unit_freight"] == "0.00"
    assert item["unit_profit"] == "12.84"


def test_mudar_custo_hora_nao_reescreve_venda_passada(api, caneca):
    sale = nova_venda(api, caneca).json()
    maker = Maker.objects.get(name="Filha")
    maker.hourly_rate = Decimal("50.00")
    maker.save()
    item = api.get(f"/api/sales/{sale['id']}/").json()["items"][0]
    assert item["unit_cogs"] == "15.16"


def test_editar_venda_recalcula_snapshot(api, caneca):
    sale = nova_venda(api, caneca).json()
    response = api.patch(
        f"/api/sales/{sale['id']}/",
        {"channel": Channel.objects.get(slug="whatsapp").pk},
        format="json",
    )
    assert response.status_code == 200, response.content
    assert response.json()["items"][0]["unit_fee"] == "0.00"


def test_produto_inativo_nao_pode_ser_vendido(api, caneca):
    caneca.is_active = False
    caneca.save()
    response = nova_venda(api, caneca)
    assert response.status_code == 400
    assert "items" in response.json()


def test_preco_zero_e_rejeitado(api, caneca):
    assert nova_venda(api, caneca, price="0.00").status_code == 400


def test_venda_traz_total_e_lucro(api, caneca):
    body = nova_venda(api, caneca, qty=2).json()
    assert body["total"] == "80.00"
    assert body["profit"] == "25.68"


def test_venda_com_lista_vazia_de_itens_e_criavel(api):
    response = api.post(
        "/api/sales/",
        {
            "date": "2026-07-10",
            "channel": Channel.objects.get(slug="shopee").pk,
            "items": [],
        },
        format="json",
    )
    assert response.status_code == 201, response.content
    assert response.json()["total"] == "0.00"


def test_filtro_por_periodo_e_canal(api, caneca):
    nova_venda(api, caneca, slug="shopee", dia="2026-07-10")
    nova_venda(api, caneca, slug="whatsapp", dia="2026-08-10")
    shopee = Channel.objects.get(slug="shopee").pk

    assert len(api.get("/api/sales/").json()) == 2
    assert len(api.get("/api/sales/?from=2026-07-01&to=2026-07-31").json()) == 1
    assert len(api.get(f"/api/sales/?channel={shopee}").json()) == 1
    assert len(api.get("/api/sales/?from=2026-09-01&to=2026-09-30").json()) == 0


def test_data_invalida_no_filtro_devolve_400(api):
    response = api.get("/api/sales/?from=10/07/2026&to=2026-07-31")
    assert response.status_code == 400
    assert "from" in response.json()


def test_canal_nao_numerico_no_filtro_devolve_400(api):
    response = api.get("/api/sales/?channel=shopee")
    assert response.status_code == 400
    assert "channel" in response.json()


def test_reenviar_o_mesmo_canal_nao_reescreve_snapshot(api, caneca):
    sale = nova_venda(api, caneca).json()
    maker = Maker.objects.get(name="Filha")
    maker.hourly_rate = Decimal("50.00")
    maker.save()

    response = api.patch(
        f"/api/sales/{sale['id']}/",
        {"channel": sale["channel"], "customer_name": "Romilda"},
        format="json",
    )

    assert response.status_code == 200, response.content
    assert response.json()["items"][0]["unit_cogs"] == "15.16"


def test_editar_campo_sem_efeito_no_calculo_nao_reescreve_snapshot(api, caneca):
    # corrigir o nome do cliente não pode re-precificar uma venda passada
    sale = nova_venda(api, caneca).json()
    maker = Maker.objects.get(name="Filha")
    maker.hourly_rate = Decimal("50.00")
    maker.save()

    response = api.patch(
        f"/api/sales/{sale['id']}/", {"customer_name": "Romilda"}, format="json"
    )

    assert response.status_code == 200, response.content
    assert response.json()["items"][0]["unit_cogs"] == "15.16"
