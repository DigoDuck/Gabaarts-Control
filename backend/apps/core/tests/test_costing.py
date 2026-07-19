from decimal import Decimal

import pytest

from apps.core.models import ComboItem, Maker, Product
from apps.core.services.costing import q2, unit_cogs

# instâncias não salvas: costing é puro e não precisa de banco (arquitetura §1.2)
ROUSELI = Maker(name="Rouseli", hourly_rate=Decimal("12.00"))
FILHA = Maker(name="Filha", hourly_rate=Decimal("10.00"))


def make_product(**kwargs):
    defaults = dict(
        material_cost=Decimal("0"), packaging_cost=Decimal("0"),
        waste_pct=Decimal("0"), production_time_min=0, batch_size=1,
    )
    return Product(**{**defaults, **kwargs})


def caneca():
    return make_product(material_cost=Decimal("10.49"), production_time_min=10,
                        maker=FILHA, packaging_cost=Decimal("3.00"))


def test_caneca_personalizada():  # planilha §0.2: R$ 15,16
    assert q2(unit_cogs(caneca())["total"]) == Decimal("15.16")


def test_chaveiro_personalizado():  # planilha §0.2: R$ 6,50
    chaveiro = make_product(material_cost=Decimal("2.50"), production_time_min=5,
                            maker=ROUSELI, packaging_cost=Decimal("3.00"))
    assert q2(unit_cogs(chaveiro)["total"]) == Decimal("6.50")


def test_caderno_20_materias():  # planilha §0.2: R$ 77,27
    caderno = make_product(material_cost=Decimal("55.60"), production_time_min=100,
                           maker=FILHA, packaging_cost=Decimal("5.00"))
    assert q2(unit_cogs(caderno)["total"]) == Decimal("77.27")


def test_breakdown_da_caneca():
    c = unit_cogs(caneca())
    assert q2(c["material"]) == Decimal("10.49")
    assert q2(c["labor"]) == Decimal("1.67")
    assert q2(c["packaging"]) == Decimal("3.00")


def test_perda_incide_so_sobre_material():  # decisão A4
    p = make_product(material_cost=Decimal("10.00"), waste_pct=Decimal("0.10"),
                     packaging_cost=Decimal("2.00"))
    c = unit_cogs(p)
    assert c["material"] == Decimal("11.00")
    assert c["packaging"] == Decimal("2.00")


def test_lote_divide_mao_de_obra():
    p = make_product(production_time_min=60, maker=ROUSELI, batch_size=10)
    assert q2(unit_cogs(p)["labor"]) == Decimal("1.20")


@pytest.mark.django_db
def test_cogs_de_kit_soma_componentes():  # arquitetura §1.4
    filha = Maker.objects.get(name="Filha")
    rouseli = Maker.objects.get(name="Rouseli")
    caneca_db = Product.objects.create(
        name="Caneca", material_cost=Decimal("10.49"), production_time_min=10,
        maker=filha, packaging_cost=Decimal("3.00"),
    )
    chaveiro_db = Product.objects.create(
        name="Chaveiro", material_cost=Decimal("2.50"), production_time_min=5,
        maker=rouseli, packaging_cost=Decimal("3.00"),
    )
    kit = Product.objects.create(
        name="Kit caneca + chaveiro", is_combo=True, packaging_cost=Decimal("1.00")
    )
    ComboItem.objects.create(combo=kit, component=caneca_db, qty=1)
    ComboItem.objects.create(combo=kit, component=chaveiro_db, qty=1)
    # 15,1566... + 6,50 + 1,00 de embalagem própria = 22,6566... → 22,66
    assert q2(unit_cogs(kit)["total"]) == Decimal("22.66")
