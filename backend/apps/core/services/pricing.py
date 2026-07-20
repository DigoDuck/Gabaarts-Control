"""Preço sugerido, simulação de margem e preço-alvo (arquitetura §2.3 e §3)."""
from decimal import Decimal

from .costing import q2, unit_cogs
from .fees import channel_fee, fee_from_tiers, tier_for


def suggested_price(cogs, margin):
    """Cost-plus para canais diretos: COGS / (1 − margem).

    `cogs` deve vir em precisão CHEIA (sem q2) — é o que faz a caneca dar
    30,31 e não 30,32 (planilha §0.2).

    Pré-condição: margin < 1 — garantida na borda (validator de
    target_margin_pct no model; serializer na fase 2). Função pura não revalida.
    """
    return q2(cogs / (1 - margin))


def margin_on_price(profit, price):
    """Margem sobre o preço (invariante do domínio): lucro / preço, nunca markup."""
    return profit / price


def margin_status(margin, target):
    """Rótulo da margem vs meta — único dono das strings usadas por service e Admin."""
    return "abaixo da meta" if margin < target else "na meta ou acima"


def simulate(product, channel, price, freight=None):
    """Margem R$ e % num preço dado + situação vs meta do produto (§3.2).

    Pré-condição: price > 0 — garantida na borda (SaleItem.clean;
    serializer na fase 2). Função pura não revalida.
    """
    if freight is None:
        freight = channel.default_freight or Decimal("0")
    cogs = unit_cogs(product)["total"]
    fee = channel_fee(channel, price)["total"]
    profit = price - cogs - fee - freight
    margin = margin_on_price(profit, price)
    status = margin_status(margin, product.target_margin_pct)
    return {
        "cogs": q2(cogs),
        "fee": q2(fee),
        "freight": q2(freight),
        "profit": q2(profit),
        "margin_pct": margin,
        "status": status,
    }


ONE_CENT = Decimal("0.01")
# tolerância p/ resíduo de divisão Decimal não rejeitar a solução exata da faixa
MARGIN_EPS = Decimal("1E-9")


def target_price(channel, cogs, margin, freight=None):
    """Menor preço que entrega a margem-alvo no canal (arquitetura §2.3).

    Enumeração de faixas, exata e sem iteração numérica:
      1. solução fechada por faixa, aceita só se o preço cai na própria faixa;
      2. limites inferiores das faixas entram como candidatos (a taxa salta neles);
      3. responde o menor candidato cuja margem real ≥ alvo.
    Retorna {price, tier, warnings}; price=None se a margem for inatingível.
    """
    if freight is None:
        freight = channel.default_freight or Decimal("0")
    tiers = list(channel.fee_tiers.order_by("min_price"))
    if not tiers:
        return {"price": suggested_price(cogs + freight, margin), "tier": None, "warnings": []}

    uppers = [t.min_price for t in tiers[1:]] + [None]
    candidates = []
    for tier, upper in zip(tiers, uppers):
        denom = 1 - tier.commission_pct - margin
        if denom <= 0:
            continue  # §2.3 passo 5: sem solução nesta faixa
        price = (cogs + freight + tier.fixed_fee) / denom
        if price >= tier.min_price and (upper is None or price < upper):
            candidates.append(price)
    candidates.extend(t.min_price for t in tiers if t.min_price > 0)

    viable = [
        p for p in sorted(candidates)
        if p > 0 and _margin_at(tiers, cogs, freight, p) >= margin - MARGIN_EPS
    ]
    if not viable:
        return {"price": None, "tier": None, "warnings": ["Margem inatingível neste canal."]}

    price = q2(viable[0])
    if tier_for(tiers, price) is not tier_for(tiers, viable[0]):
        # ROUND_HALF_UP cruzou a fronteira de faixa: recua 1 centavo para
        # permanecer na faixa validada (melhor preço em 2 casas dessa faixa)
        price -= ONE_CENT
    return {
        "price": price,
        "tier": tier_for(tiers, price),
        "warnings": _dead_zone_warning(tiers, price),
    }


def _margin_at(tiers, cogs, freight, price):
    # taxa sempre via services/fees — único ponto de entrada (CLAUDE.md)
    fee = fee_from_tiers(tiers, price)["total"]
    return (price - cogs - fee - freight) / price


def _dead_zone_warning(tiers, price):
    """Zona morta (§2.2): logo acima da próxima fronteira o líquido despenca.

    COGS e frete são constantes dos dois lados da fronteira, então a zona
    morta só depende das taxas — por isso não entram aqui.
    """
    current = tier_for(tiers, price)
    if current is None:
        # defensivo: hoje todo candidato viável cai dentro de alguma faixa,
        # mas chamadas diretas (fase 2) não têm essa garantia
        return []
    idx = tiers.index(current)
    if idx + 1 >= len(tiers):
        return []
    nxt = tiers[idx + 1]
    edge = nxt.min_price - ONE_CENT
    net_edge = edge - (edge * current.commission_pct + current.fixed_fee)
    denom = 1 - nxt.commission_pct
    if denom <= 0:
        return []
    recovery = (net_edge + nxt.fixed_fee) / denom  # preço onde o líquido volta a empatar
    if recovery <= nxt.min_price:
        return []
    return [
        f"Zona morta: entre R$ {q2(nxt.min_price)} e R$ {q2(recovery)} o líquido é menor "
        f"que em R$ {q2(edge)}. Fique em R$ {q2(edge)} ou pule para R$ {q2(recovery)}+."
    ]
