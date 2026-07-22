"""Custo unitário (COGS) — funções puras sobre Decimal (arquitetura §1.2).

Regra de arredondamento (§3.1): tudo aqui devolve precisão CHEIA;
ROUND_HALF_UP é aplicado UMA vez, na borda (snapshot/Admin), via q2().
É o que faz o COGS 15,156... da caneca virar preço sugerido 30,31, não 30,32.
"""
from decimal import Decimal, ROUND_HALF_UP

CENTS = Decimal("0.01")


def q2(value):
    """Arredonda para 2 casas (ROUND_HALF_UP). Usar só na borda, nunca no meio."""
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


def unit_cogs(product, combo_items=None):
    """COGS unitário com breakdown: {material, labor, packaging, total}.

    material inclui a perda (material × (1 + waste_pct), só sobre material — A4);
    mão de obra = tempo × custo_hora ÷ 60 ÷ lote; kit soma os componentes (§1.4).

    combo_items: componentes já em memória. O preview calcula sobre um Product
    sem pk, onde o related manager não existe; sem esse parâmetro a agregação
    do kit teria de ser reescrita fora daqui, e a fórmula deixaria de ter um
    único dono.
    """
    material = product.material_cost * (1 + product.waste_pct)
    rate = product.maker.hourly_rate if product.maker else Decimal("0")
    labor = Decimal(product.production_time_min) * rate / 60 / product.batch_size
    packaging = product.packaging_cost

    if product.is_combo:
        if combo_items is None:
            combo_items = product.combo_items.select_related("component__maker").all()
        for item in combo_items:
            comp = unit_cogs(item.component)  # profundidade 1: kit de kit é bloqueado no clean()
            material += item.qty * comp["material"]
            labor += item.qty * comp["labor"]
            packaging += item.qty * comp["packaging"]

    return {
        "material": material,
        "labor": labor,
        "packaging": packaging,
        "total": material + labor + packaging,
    }
