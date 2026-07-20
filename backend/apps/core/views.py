"""Views da API: só transporte e orquestração; cálculo mora em services/."""

from datetime import date

from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError

from .models import Channel, Equipment, Maker, Product, Sale
from .serializers import (
    ChannelSerializer,
    EquipmentSerializer,
    MakerSerializer,
    ProductSerializer,
    SaleSerializer,
)


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
