"""Catálogo completo da planilha como caso de teste (estende arquitetura §0.2).

Fonte: planilha Gabaarts_Oficial, abas "Custo Unitário" e "Precificação",
lidas em 20/07/2026. Todos os produtos têm perda 0% e lote 1 na planilha.
Números conferidos manualmente: se um destes falhar, o bug está no service.
"""

from decimal import Decimal

import pytest

from apps.core.models import Maker, Product
from apps.core.services.costing import q2, unit_cogs
from apps.core.services.pricing import suggested_price

# instâncias não salvas: costing é função pura, não precisa de banco
MAKERS = {
    "Rouseli": Maker(name="Rouseli", hourly_rate=Decimal("12.00")),
    "Filha": Maker(name="Filha", hourly_rate=Decimal("10.00")),
}

# (produto, material, min/lote, quem faz, embalagem, margem-alvo, COGS, preço sugerido)
CATALOG = [
    ("Canecas personalizadas", "10.49", 10, "Filha", "3.00", "0.50", "15.16", "30.31"),
    ("Ímãs personalizados", "2.70", 5, "Filha", "3.00", "0.50", "6.53", "13.07"),
    ("Chaveiros personalizados", "2.50", 5, "Rouseli", "3.00", "0.50", "6.50", "13.00"),
    ("Bottons personalizados", "1.50", 8, "Filha", "1.50", "0.50", "4.33", "8.67"),
    ("Caderno 1 matéria", "31.50", 60, "Filha", "5.00", "0.20", "46.50", "58.13"),
    ("Caderno 10 matérias", "39.60", 80, "Rouseli", "5.00", "0.50", "60.60", "121.20"),
    ("Caderno 15 matérias", "49.20", 90, "Rouseli", "5.00", "0.50", "72.20", "144.40"),
    ("Caderno 20 matérias", "55.60", 100, "Filha", "5.00", "0.25", "77.27", "103.02"),
    ("Agenda simples", "26.40", 60, "Rouseli", "5.00", "0.50", "43.40", "86.80"),
    ("Agenda clássica", "31.60", 80, "Rouseli", "5.00", "0.50", "52.60", "105.20"),
    ("Agenda luxo", "36.50", 100, "Rouseli", "5.00", "0.50", "61.50", "123.00"),
    ("Caderneta de saúde", "39.45", 80, "Filha", "5.00", "0.50", "57.78", "115.57"),
    ("Caderneta de gestante", "39.45", 80, "Rouseli", "5.00", "0.50", "60.45", "120.90"),
    ("Álbum do bebê", "59.25", 90, "Rouseli", "5.00", "0.50", "82.25", "164.50"),
    ("Álbum de Foto", "59.25", 90, "Rouseli", "5.00", "0.50", "82.25", "164.50"),
    ("Etiquetas escolares/Adesivo", "2.00", 5, "Rouseli", "3.00", "0.50", "6.00", "12.00"),
    ("Tabuadas chaveiro", "3.90", 20, "Rouseli", "3.00", "0.50", "10.90", "21.80"),
    ("Azulejo", "13.30", 15, "Rouseli", "5.00", "0.50", "21.30", "42.60"),
    ("Relógio", "14.30", 20, "Rouseli", "5.00", "0.50", "23.30", "46.60"),
]


@pytest.mark.parametrize(
    "name,material,minutes,maker,packaging,margin,expected_cogs,expected_price", CATALOG
)
def test_catalogo_da_planilha(
    name, material, minutes, maker, packaging, margin, expected_cogs, expected_price
):
    product = Product(
        name=name,
        material_cost=Decimal(material),
        production_time_min=minutes,
        maker=MAKERS[maker],
        packaging_cost=Decimal(packaging),
        waste_pct=Decimal("0"),
        batch_size=1,
    )
    # precisão cheia entra no preço sugerido; q2 só na comparação exibida
    cogs = unit_cogs(product)["total"]
    assert q2(cogs) == Decimal(expected_cogs), f"COGS de {name}"
    assert suggested_price(cogs, Decimal(margin)) == Decimal(
        expected_price
    ), f"preço de {name}"


def test_catalogo_tem_os_19_produtos_da_planilha():
    assert len(CATALOG) == 19
