"""Apuração e snapshot da venda pelo total do pedido (arquitetura §1.3)."""

from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.core.models import Sale, SaleItem

from .costing import q2, unit_cogs
from .fees import fee_from_tiers


FOUR_PLACES = Decimal("0.0001")
ZERO = Decimal("0")


def q4(value):
    """Arredonda frações percentuais em quatro casas com HALF_UP."""
    return value.quantize(FOUR_PLACES, rounding=ROUND_HALF_UP)


def _validated_items(items):
    rows = list(items)
    if not rows:
        raise ValidationError({"items": "A venda precisa de ao menos um item."})

    errors = {}
    for index, item in enumerate(rows):
        if item.qty < 1:
            errors[f"items.{index}.qty"] = "Quantidade deve ser ao menos 1."
        if not item.product.is_active:
            errors[f"items.{index}.product"] = "Produto inativo não pode ser vendido."
        if item.product.base_price is None or item.product.base_price <= 0:
            errors[f"items.{index}.product"] = (
                "Cadastre um preço-base positivo para estimar a taxa do pedido."
            )
    if errors:
        raise ValidationError(errors)
    return rows


def calculate_sale(
    channel,
    products_total,
    items,
    shipping_amount=ZERO,
    fee_override=None,
    tiers=None,
):
    """Calcula o rascunho financeiro usado por preview e persistência.

    O total é distribuído proporcionalmente ao preço-base para obter apenas a
    estimativa unitária exigida pelas faixas. A taxa real informada substitui a
    sugestão, mas nunca cria outra fórmula.
    """
    products_total = Decimal(products_total)
    shipping_amount = Decimal(shipping_amount)
    fee_override = Decimal(fee_override) if fee_override is not None else None
    errors = {}
    if products_total <= 0:
        errors["products_total"] = "Total dos produtos deve ser maior que zero."
    if shipping_amount < 0:
        errors["shipping_amount"] = "Frete não pode ser negativo."
    if fee_override is not None and fee_override < 0:
        errors["fee_override"] = "Taxa informada não pode ser negativa."
    if errors:
        raise ValidationError(errors)

    rows = _validated_items(items)
    base_total = sum(
        (item.product.base_price * item.qty for item in rows), ZERO
    )
    loaded_tiers = (
        list(channel.fee_tiers.order_by("min_price")) if tiers is None else list(tiers)
    )

    item_cogs = [q2(unit_cogs(item.product)["total"]) for item in rows]
    total_cogs = q2(sum((cost * item.qty for cost, item in zip(item_cogs, rows)), ZERO))

    suggested_fee = ZERO
    for item in rows:
        estimated_unit_price = products_total * item.product.base_price / base_total
        unit_fee = q2(fee_from_tiers(loaded_tiers, estimated_unit_price)["total"])
        suggested_fee += unit_fee * item.qty
    suggested_fee = q2(suggested_fee)

    applied_fee = q2(fee_override if fee_override is not None else suggested_fee)
    profit = q2(products_total - total_cogs - applied_fee)
    margin_pct = q4(profit / products_total)
    target_margin_pct = q4(
        sum(
            (
                item.product.base_price
                * item.qty
                * item.product.target_margin_pct
                for item in rows
            ),
            ZERO,
        )
        / base_total
    )

    warnings = []
    if profit < 0:
        warnings.append("Prejuízo: o pedido não cobre os custos e a taxa do canal.")
    if margin_pct < target_margin_pct:
        warnings.append("Margem abaixo da meta ponderada dos produtos.")
    if fee_override is not None and fee_override > suggested_fee:
        warnings.append("A taxa informada está acima da taxa sugerida.")
    if products_total < base_total * Decimal("0.80"):
        warnings.append("Total do pedido mais de 20% abaixo da soma dos preços-base.")

    return {
        "item_cogs": item_cogs,
        "total_cogs": total_cogs,
        "suggested_channel_fee": suggested_fee,
        "applied_channel_fee": applied_fee,
        "fee_source": (
            Sale.FeeSource.MANUAL
            if fee_override is not None
            else Sale.FeeSource.SUGGESTED
        ),
        "profit": profit,
        "margin_pct": margin_pct,
        "target_margin_pct": target_margin_pct,
        "amount_paid": q2(products_total + shipping_amount),
        "warnings": warnings,
    }


def snapshot_result(sale):
    """Lê somente fatos e snapshots persistidos, sem usar parâmetros atuais."""
    rows = list(sale.items.all())
    total_cogs = q2(sum((item.unit_cogs * item.qty for item in rows), ZERO))
    profit = q2(
        sale.products_total
        - total_cogs
        - sale.channel_fee
        - sale.legacy_freight_cost
    )
    return {
        "total_cogs": total_cogs,
        "applied_channel_fee": q2(sale.channel_fee),
        "fee_source": sale.fee_source,
        "profit": profit,
        "margin_pct": q4(profit / sale.products_total),
        "amount_paid": q2(sale.products_total + sale.shipping_amount),
    }


@transaction.atomic
def refresh_snapshots(sale, fee_override=None):
    """Congela COGS unitário e taxa do pedido num único commit atômico."""
    rows = list(sale.items.select_related("product__maker").order_by("id"))
    tiers = list(sale.channel.fee_tiers.order_by("min_price"))
    calculation = calculate_sale(
        sale.channel,
        sale.products_total,
        rows,
        shipping_amount=sale.shipping_amount,
        fee_override=fee_override,
        tiers=tiers,
    )

    for item, frozen_cogs in zip(rows, calculation["item_cogs"]):
        item.unit_cogs = frozen_cogs
    SaleItem.objects.bulk_update(rows, ["unit_cogs"])

    sale.channel_fee = calculation["applied_channel_fee"]
    sale.fee_source = calculation["fee_source"]
    sale.save(update_fields=["channel_fee", "fee_source"])

    frozen = snapshot_result(sale)
    frozen.update(
        suggested_channel_fee=calculation["suggested_channel_fee"],
        target_margin_pct=calculation["target_margin_pct"],
        warnings=calculation["warnings"],
    )
    return frozen
