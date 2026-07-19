"""Preço sugerido, simulação de margem e preço-alvo (arquitetura §2.3 e §3)."""
from decimal import Decimal

from .costing import q2, unit_cogs
from .fees import channel_fee


def suggested_price(cogs, margin):
    """Cost-plus para canais diretos: COGS / (1 − margem).

    `cogs` deve vir em precisão CHEIA (sem q2) — é o que faz a caneca dar
    30,31 e não 30,32 (planilha §0.2).
    """
    return q2(cogs / (1 - margin))


def simulate(product, channel, price, freight=None):
    """Margem R$ e % num preço dado + situação vs meta do produto (§3.2)."""
    if freight is None:
        freight = channel.default_freight or Decimal("0")
    cogs = unit_cogs(product)["total"]
    fee = channel_fee(channel, price)["total"]
    profit = price - cogs - fee - freight
    margin = profit / price
    status = "abaixo da meta" if margin < product.target_margin_pct else "na meta ou acima"
    return {
        "cogs": q2(cogs),
        "fee": q2(fee),
        "freight": freight,
        "profit": q2(profit),
        "margin_pct": margin,
        "status": status,
    }
