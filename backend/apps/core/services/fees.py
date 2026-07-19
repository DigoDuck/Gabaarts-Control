"""Taxa por canal — ÚNICO ponto de entrada para taxa no sistema (arquitetura §2.2).

Canal futuro com regra que não caiba em faixas vira um desvio AQUI dentro,
sem mudar quem chama.
"""
from decimal import Decimal


def tier_for(tiers, unit_price):
    """Faixa vigente no preço: a de maior min_price ≤ preço (lista já ordenada por min_price)."""
    current = None
    for tier in tiers:
        if tier.min_price <= unit_price:
            current = tier
    return current


def fee_from_tiers(tiers, unit_price):
    """Taxa a partir de faixas já carregadas em memória: {pct, fixed, total}."""
    tier = tier_for(tiers, unit_price)
    if tier is None:
        return {"pct": Decimal("0"), "fixed": Decimal("0"), "total": Decimal("0")}
    return {
        "pct": tier.commission_pct,
        "fixed": tier.fixed_fee,
        "total": unit_price * tier.commission_pct + tier.fixed_fee,
    }


def channel_fee(channel, unit_price):
    """Taxa do canal no preço dado: {pct, fixed, total}, Decimal em precisão cheia.

    taxa(preço) = comissão%(faixa) × preço + fixo(faixa); a faixa vigente é a de
    maior min_price ≤ preço. Canal sem faixas cadastradas = taxa zero (direto).
    """
    return fee_from_tiers(list(channel.fee_tiers.order_by("min_price")), unit_price)
