"""Views da API: só transporte e orquestração; cálculo mora em services/."""

from datetime import date

from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Channel, ComboItem, Equipment, Maker, Product, Sale
from .serializers import (
    ChannelFeeTierSerializer,
    ChannelSerializer,
    EquipmentSerializer,
    MakerSerializer,
    PCT,
    ProductPreviewSerializer,
    ProductSerializer,
    SaleSerializer,
    SimulateInputSerializer,
    TargetPriceInputSerializer,
)
from .services.costing import q2, unit_cogs
from .services.pricing import simulate, suggested_price, target_price
from .services.reports import sales_summary


def date_param(request, name):
    """Converte um query param opcional no formato AAAA-MM-DD."""
    raw = request.query_params.get(name)
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        raise ValidationError({name: "Use o formato AAAA-MM-DD."}) from exc


def channel_param(request):
    """Resolve um id de canal opcional vindo dos query params."""
    raw = request.query_params.get("channel")
    if not raw:
        return None
    if not raw.isdigit():
        raise ValidationError({"channel": "Informe o id numérico do canal."})
    return get_object_or_404(Channel, pk=raw)


class MakerViewSet(viewsets.ModelViewSet):
    queryset = Maker.objects.order_by("name")
    serializer_class = MakerSerializer


class EquipmentViewSet(viewsets.ModelViewSet):
    queryset = Equipment.objects.order_by("name")
    serializer_class = EquipmentSerializer


class ChannelViewSet(viewsets.ModelViewSet):
    # a Meta de ChannelFeeTier já ordena por channel e min_price
    queryset = Channel.objects.prefetch_related("fee_tiers").order_by("name")
    serializer_class = ChannelSerializer


class ProductViewSet(viewsets.ModelViewSet):
    queryset = (
        Product.objects.select_related("maker")
        .prefetch_related("combo_items__component__maker")
        .order_by("name")
    )
    serializer_class = ProductSerializer

    @action(detail=False, methods=["post"])
    def preview(self, request):
        """COGS e preço sugerido de um rascunho, sem gravar nada.

        partial=True porque rascunho é incompleto por natureza: os campos
        ausentes caem no default do model.
        """
        payload = ProductPreviewSerializer(data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        data = dict(payload.validated_data)
        items = [
            ComboItem(component=item["component"], qty=item.get("qty", 1))
            for item in data.pop("combo_items", [])
        ]
        draft = Product(**data)
        cogs = unit_cogs(draft, combo_items=items)
        return Response(
            {
                "cogs": {key: str(q2(value)) for key, value in cogs.items()},
                "suggested_price": str(
                    suggested_price(cogs["total"], draft.target_margin_pct)
                ),
            }
        )


class SaleViewSet(viewsets.ModelViewSet):
    queryset = (
        Sale.objects.select_related("channel")
        .prefetch_related("items__product")
        .order_by("-date", "-id")
    )
    serializer_class = SaleSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        date_from = date_param(self.request, "from")
        date_to = date_param(self.request, "to")
        channel = channel_param(self.request)
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        if channel:
            queryset = queryset.filter(channel=channel)
        return queryset


class SimulateView(APIView):
    """Margem R$ e percentual num preço dado, comparada com a meta."""

    def post(self, request):
        payload = SimulateInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        result = simulate(
            data["product"], data["channel"], data["price"], data.get("freight")
        )
        # dinheiro e percentual saem como string para preservar Decimal no JSON
        return Response(
            {
                "cogs": str(result["cogs"]),
                "fee": str(result["fee"]),
                "freight": str(result["freight"]),
                "profit": str(result["profit"]),
                "margin_pct": str(result["margin_pct"].quantize(PCT)),
                "status": result["status"],
            }
        )


class TargetPriceView(APIView):
    """Menor preço que entrega a margem-alvo no canal, com avisos."""

    def post(self, request):
        payload = TargetPriceInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        cogs = unit_cogs(data["product"])["total"]
        result = target_price(
            data["channel"], cogs, data["margin"], data.get("freight")
        )
        return Response(
            {
                "price": str(result["price"])
                if result["price"] is not None
                else None,
                "tier": ChannelFeeTierSerializer(result["tier"]).data
                if result["tier"]
                else None,
                "warnings": result["warnings"],
            }
        )


class SummaryView(APIView):
    """KPIs do dashboard, todos derivados pelo service de relatórios."""

    def get(self, request):
        date_from = date_param(request, "from")
        date_to = date_param(request, "to")
        if date_from is None or date_to is None:
            raise ValidationError(
                {"from": "Informe 'from' e 'to' no formato AAAA-MM-DD."}
            )
        summary = sales_summary(date_from, date_to, channel_param(request))
        # dinheiro sai como string para o JSONRenderer não converter Decimal em float
        return Response(
            {
                "revenue": str(summary["revenue"]),
                "profit": str(summary["profit"]),
                "sales_count": summary["sales_count"],
                "avg_ticket": str(summary["avg_ticket"]),
                "by_channel": [
                    {
                        "channel": row["sale__channel_id"],
                        "channel_name": row["channel_name"],
                        "revenue": str(row["revenue"]),
                        "profit": str(row["profit"]),
                    }
                    for row in summary["by_channel"]
                ],
            }
        )
