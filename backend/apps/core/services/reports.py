"""Relatórios agregados via ORM — só vendas concluídas (arquitetura §3.2).

Sem tabela de resumo materializada: aggregate() resolve neste volume (§5).
"""
from decimal import Decimal

from django.db.models import (
    Count,
    DecimalField,
    ExpressionWrapper,
    F,
    OuterRef,
    Subquery,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce

from apps.core.models import Sale, SaleItem
from .costing import q2

MONEY = DecimalField(max_digits=13, decimal_places=2)
ITEM_COGS = ExpressionWrapper(F("qty") * F("unit_cogs"), output_field=MONEY)


def sales_summary(date_from, date_to, channel=None):
    """Receita, lucro, nº de vendas, ticket médio e quebra por canal no período."""
    item_costs = (
        SaleItem.objects.filter(sale_id=OuterRef("pk"))
        .values("sale_id")
        .annotate(total=Sum(ITEM_COGS))
        .values("total")
    )
    sales = (
        Sale.objects.filter(
            status=Sale.Status.COMPLETED,
            date__range=(date_from, date_to),
        )
        .annotate(
            total_cogs=Coalesce(
                Subquery(item_costs, output_field=MONEY),
                Value(Decimal("0")),
                output_field=MONEY,
            )
        )
        .annotate(
            sale_profit=ExpressionWrapper(
                F("products_total")
                - F("total_cogs")
                - F("channel_fee")
                - F("legacy_freight_cost"),
                output_field=MONEY,
            )
        )
    )
    if channel is not None:
        sales = sales.filter(channel=channel)

    # count de vendas distintas vai junto do aggregate: era uma query só para ele
    totals = sales.aggregate(
        revenue=Sum("products_total"),
        profit=Sum("sale_profit"),
        sales_count=Count("id"),
    )
    revenue = totals["revenue"] if totals["revenue"] is not None else Decimal("0.00")
    profit = totals["profit"] if totals["profit"] is not None else Decimal("0.00")
    sales_count = totals["sales_count"]

    by_channel = list(
        sales.values("channel_id", channel_name=F("channel__name"))
        .annotate(revenue=Sum("products_total"), profit=Sum("sale_profit"))
        .order_by("-revenue")
    )
    return {
        "revenue": revenue,
        "profit": profit,
        "sales_count": sales_count,
        "avg_ticket": q2(revenue / sales_count) if sales_count else Decimal("0.00"),
        "by_channel": by_channel,
    }
