from decimal import Decimal

import pytest

from apps.core.models import Channel, Maker, Product
from apps.core.services.costing import unit_cogs
from apps.core.services.pricing import simulate, suggested_price


def caneca_cogs():
    # precisão cheia (15,1566...), não o 15,16 exibido — ver Global Constraints
    caneca = Product(
        material_cost=Decimal("10.49"), production_time_min=10,
        maker=Maker(hourly_rate=Decimal("10.00")),
        packaging_cost=Decimal("3.00"), waste_pct=Decimal("0"), batch_size=1,
    )
    return unit_cogs(caneca)["total"]


def test_preco_sugerido_caneca():  # planilha §0.2: R$ 30,31 (nunca 30,32)
    assert suggested_price(caneca_cogs(), Decimal("0.5")) == Decimal("30.31")


@pytest.mark.django_db
def test_simulate_caneca_na_shopee():
    filha = Maker.objects.get(name="Filha")
    caneca = Product.objects.create(
        name="Caneca", material_cost=Decimal("10.49"), production_time_min=10,
        maker=filha, packaging_cost=Decimal("3.00"), target_margin_pct=Decimal("0.5"),
    )
    shopee = Channel.objects.get(slug="shopee")
    result = simulate(caneca, shopee, Decimal("40.00"))
    assert result["fee"] == Decimal("12.00")
    assert result["profit"] == Decimal("12.84")  # 40 − 15,1566... − 12 → 12,84
    assert result["status"] == "abaixo da meta"  # 32,1% < meta de 50%


@pytest.mark.django_db
def test_simulate_arredonda_frete_na_saida():
    filha = Maker.objects.get(name="Filha")
    caneca = Product.objects.create(
        name="Caneca", material_cost=Decimal("10.49"), production_time_min=10,
        maker=filha, packaging_cost=Decimal("3.00"), target_margin_pct=Decimal("0.5"),
    )
    shopee = Channel.objects.get(slug="shopee")
    result = simulate(caneca, shopee, Decimal("40.00"), freight=Decimal("3.456"))
    assert result["freight"] == Decimal("3.46")


# --- target_price (arquitetura §2.3) ---
from apps.core.services.pricing import target_price  # noqa: E402


@pytest.mark.django_db
def test_preco_alvo_shopee_cai_na_faixa():
    shopee = Channel.objects.get(slug="shopee")
    result = target_price(shopee, Decimal("30.00"), Decimal("0.37"))
    # faixa 8–80 (20% + 4): (30 + 4) / (1 − 0,20 − 0,37) = 79,0697... → 79,07
    assert result["price"] == Decimal("79.07")
    assert result["tier"].min_price == Decimal("8.00")


@pytest.mark.django_db
def test_preco_alvo_avisa_zona_morta():  # §2.2: "fique em 79,99 ou pule para 88,36+"
    shopee = Channel.objects.get(slug="shopee")
    result = target_price(shopee, Decimal("30.00"), Decimal("0.37"))
    assert any("88.36" in w for w in result["warnings"])


@pytest.mark.django_db
def test_margem_inatingivel():  # §2.3 passo 5: 90% não cabe em faixa nenhuma
    shopee = Channel.objects.get(slug="shopee")
    result = target_price(shopee, Decimal("30.00"), Decimal("0.90"))
    assert result["price"] is None
    assert result["warnings"] == ["Margem inatingível neste canal."]


@pytest.mark.django_db
def test_preco_alvo_canal_direto_equivale_ao_cost_plus():
    insta = Channel.objects.get(slug="instagram")
    result = target_price(insta, caneca_cogs(), Decimal("0.5"))
    assert result["price"] == Decimal("30.31")


@pytest.mark.django_db
def test_arredondamento_nao_cruza_fronteira_de_faixa():
    shopee = Channel.objects.get(slug="shopee")
    # candidato exato 79,9976...: HALF_UP daria 80,00 e trocaria de faixa (20%+4 → 14%+16)
    result = target_price(shopee, Decimal("30.399"), Decimal("0.37"))
    assert result["price"] == Decimal("79.99")
    assert result["tier"].min_price == Decimal("8.00")
