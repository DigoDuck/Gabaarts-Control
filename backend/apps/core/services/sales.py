"""Snapshot da venda (arquitetura §1.3): congela custo, taxa e frete por item.

Chamado pelo Admin (save_related) e, na fase 2, pelo serializer. Lucro deriva
SÓ dos campos congelados; mudar parâmetro nunca reescreve venda passada.
"""
from decimal import Decimal

from django.db import transaction

from .costing import q2, unit_cogs
from .fees import fee_from_tiers


def refresh_snapshots(sale):
    """(Re)calcula os snapshots de todos os itens da venda.

    Criar E editar passam por aqui (editar recalcula explicitamente, §1.3).
    Frete: manual por item; só preenche com o padrão do canal quando ainda
    não foi informado (null), nunca sobrescreve valor digitado (decisão A5).
    """
    # tudo-ou-nada: falha no meio não pode deixar a venda meio-congelada
    with transaction.atomic():
        # faixas e frete do canal lidos UMA vez; antes channel_fee relia as
        # faixas a cada item (N+1). fee_from_tiers dá o mesmo resultado sobre a
        # lista já em memória.
        tiers = list(sale.channel.fee_tiers.order_by("min_price"))
        default_freight = sale.channel.default_freight or Decimal("0")
        # Arredondamento (§3.1): a borda é AQUI, por unidade. Congela unit_cogs e
        # unit_fee em 2 casas. Consequência deliberada: o total de linha é
        # qty × valor_arredondado, que pode diferir 1 centavo do round(qty × custo
        # cheio) da planilha quando qty > 1 (ex.: bottons ×4 → 22,68 vs 22,67).
        # Convenção aceita; arredondar por linha exigiria guardar precisão cheia.
        for item in sale.items.select_related("product__maker").all():
            item.unit_cogs = q2(unit_cogs(item.product)["total"])
            item.unit_fee = q2(fee_from_tiers(tiers, item.unit_price)["total"])
            if item.unit_freight is None:
                item.unit_freight = default_freight
            item.save(update_fields=["unit_cogs", "unit_fee", "unit_freight"])
