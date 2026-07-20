"""Views da API: só transporte e orquestração; cálculo mora em services/."""

from rest_framework import viewsets

from .models import Equipment, Maker
from .serializers import EquipmentSerializer, MakerSerializer


class MakerViewSet(viewsets.ModelViewSet):
    queryset = Maker.objects.order_by("name")
    serializer_class = MakerSerializer


class EquipmentViewSet(viewsets.ModelViewSet):
    queryset = Equipment.objects.order_by("name")
    serializer_class = EquipmentSerializer
