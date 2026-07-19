"""Snapshot da venda (arquitetura §1.3): congela custo, taxa e frete por item.

Chamado pelo Admin (save_related) e, na fase 2, pelo serializer. Lucro deriva
SÓ dos campos congelados; mudar parâmetro nunca reescreve venda passada.
"""
from decimal import Decimal

from .costing import q2, unit_cogs
from .fees import channel_fee


def refresh_snapshots(sale):
    """(Re)calcula os snapshots de todos os itens da venda.

    Criar E editar passam por aqui (editar recalcula explicitamente, §1.3).
    Frete: manual por item; só preenche com o padrão do canal quando ainda
    não foi informado (null), nunca sobrescreve valor digitado (decisão A5).
    """
    for item in sale.items.select_related("product__maker").all():
        item.unit_cogs = q2(unit_cogs(item.product)["total"])
        item.unit_fee = q2(channel_fee(sale.channel, item.unit_price)["total"])
        if item.unit_freight is None:
            item.unit_freight = sale.channel.default_freight or Decimal("0")
        item.save(update_fields=["unit_cogs", "unit_fee", "unit_freight"])
