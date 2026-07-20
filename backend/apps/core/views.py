"""Views da API: só transporte e orquestração; cálculo mora em services/."""

from rest_framework import viewsets

from .models import Channel, Equipment, Maker, Product
from .serializers import (
    ChannelSerializer,
    EquipmentSerializer,
    MakerSerializer,
    ProductSerializer,
)


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
