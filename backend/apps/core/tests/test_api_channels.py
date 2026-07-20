from decimal import Decimal

import pytest

from apps.core.models import Channel

pytestmark = pytest.mark.django_db


def test_canal_traz_as_faixas_aninhadas(api):
    canais = {channel["slug"]: channel for channel in api.get("/api/channels/").json()}
    faixas = canais["shopee"]["fee_tiers"]
    assert len(faixas) == 5
    assert [tier["min_price"] for tier in faixas] == [
        "0.00",
        "8.00",
        "80.00",
        "100.00",
        "200.00",
    ]


def test_cria_canal_com_faixas(api):
    response = api.post(
        "/api/channels/",
        {
            "name": "Mercado Livre",
            "slug": "mercado-livre",
            "fee_tiers": [
                {
                    "min_price": "0.00",
                    "commission_pct": "0.1400",
                    "fixed_fee": "6.00",
                },
                {
                    "min_price": "79.00",
                    "commission_pct": "0.1400",
                    "fixed_fee": "0.00",
                },
            ],
        },
        format="json",
    )
    assert response.status_code == 201, response.content
    channel = Channel.objects.get(slug="mercado-livre")
    assert channel.fee_tiers.count() == 2


def test_update_substitui_as_faixas(api):
    channel = Channel.objects.get(slug="site")
    response = api.patch(
        f"/api/channels/{channel.pk}/",
        {
            "fee_tiers": [
                {
                    "min_price": "0.00",
                    "commission_pct": "0.0399",
                    "fixed_fee": "0.00",
                }
            ]
        },
        format="json",
    )
    assert response.status_code == 200, response.content
    assert channel.fee_tiers.count() == 1
    assert channel.fee_tiers.get().commission_pct == Decimal("0.0399")


def test_faixa_repetida_no_mesmo_canal_e_rejeitada(api):
    response = api.post(
        "/api/channels/",
        {
            "name": "Duplicado",
            "slug": "duplicado",
            "fee_tiers": [
                {
                    "min_price": "10.00",
                    "commission_pct": "0.10",
                    "fixed_fee": "0.00",
                },
                {
                    "min_price": "10.00",
                    "commission_pct": "0.20",
                    "fixed_fee": "0.00",
                },
            ],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "fee_tiers" in response.json()


def test_comissao_acima_de_100_pct_e_rejeitada(api):
    response = api.post(
        "/api/channels/",
        {
            "name": "Absurdo",
            "slug": "absurdo",
            "fee_tiers": [
                {
                    "min_price": "0.00",
                    "commission_pct": "1.5000",
                    "fixed_fee": "0.00",
                }
            ],
        },
        format="json",
    )
    assert response.status_code == 400
