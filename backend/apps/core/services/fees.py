"""Taxa por canal — ÚNICO ponto de entrada para taxa no sistema (arquitetura §2.2).

Canal futuro com regra que não caiba em faixas vira um desvio AQUI dentro,
sem mudar quem chama.
"""
from decimal import Decimal


def channel_fee(channel, unit_price):
    """Taxa do canal no preço dado: {pct, fixed, total}, Decimal em precisão cheia.

    taxa(preço) = comissão%(faixa) × preço + fixo(faixa); a faixa vigente é a de
    maior min_price ≤ preço. Canal sem faixas cadastradas = taxa zero (direto).
    """
    tier = (
        channel.fee_tiers.filter(min_price__lte=unit_price)
        .order_by("-min_price")
        .first()
    )
    if tier is None:
        return {"pct": Decimal("0"), "fixed": Decimal("0"), "total": Decimal("0")}
    return {
        "pct": tier.commission_pct,
        "fixed": tier.fixed_fee,
        "total": unit_price * tier.commission_pct + tier.fixed_fee,
    }
