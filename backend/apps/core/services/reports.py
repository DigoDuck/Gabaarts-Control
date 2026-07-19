"""Relatórios agregados via ORM — só vendas concluídas (arquitetura §3.2).

Sem tabela de resumo materializada: aggregate() resolve neste volume (§5).
"""
from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Sum, Value
from django.db.models.functions import Coalesce

from apps.core.models import Sale, SaleItem
from .costing import q2

MONEY = DecimalField(max_digits=12, decimal_places=2)
# frete null = snapshot ainda não rodou; conta como zero em vez de anular a linha
FREIGHT = Coalesce(F("unit_freight"), Value(Decimal("0")))
REVENUE = ExpressionWrapper(F("qty") * F("unit_price"), output_field=MONEY)
PROFIT = ExpressionWrapper(
    F("qty") * (F("unit_price") - F("unit_cogs") - F("unit_fee") - FREIGHT),
    output_field=MONEY,
)


def sales_summary(date_from, date_to, channel=None):
    """Receita, lucro, nº de vendas, ticket médio e quebra por canal no período."""
    items = SaleItem.objects.filter(
        sale__status=Sale.Status.COMPLETED,
        sale__date__range=(date_from, date_to),
    )
    if channel is not None:
        items = items.filter(sale__channel=channel)

    totals = items.aggregate(revenue=Sum(REVENUE), profit=Sum(PROFIT))
    revenue = totals["revenue"] if totals["revenue"] is not None else Decimal("0.00")
    profit = totals["profit"] if totals["profit"] is not None else Decimal("0.00")
    sales_count = items.values("sale_id").distinct().count()

    by_channel = list(
        items.values("sale__channel_id", channel_name=F("sale__channel__name"))
        .annotate(revenue=Sum(REVENUE), profit=Sum(PROFIT))
        .order_by("-revenue")
    )
    return {
        "revenue": revenue,
        "profit": profit,
        "sales_count": sales_count,
        "avg_ticket": q2(revenue / sales_count) if sales_count else Decimal("0.00"),
        "by_channel": by_channel,
    }
