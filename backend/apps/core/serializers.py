"""Serializers da API: validam entrada e transportam dados.

Nenhuma regra de negócio nasce aqui: regras existentes vêm do clean() dos
models, via ModelCleanMixin, ou dos services.
"""

import copy

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from .models import Channel, ChannelFeeTier, ComboItem, Equipment, Maker, Product
from .services.costing import q2, unit_cogs
from .services.pricing import suggested_price


class ModelCleanMixin:
    """Executa o clean() do model dentro do serializer."""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # campos aninhados são listas e não pertencem diretamente à instância
        own = {key: value for key, value in attrs.items() if not isinstance(value, list)}
        if self.instance is None:
            instance = self.Meta.model(**own)
        else:
            # a validação não pode mutar a instância real quando falhar
            instance = copy.deepcopy(self.instance)
            for key, value in own.items():
                setattr(instance, key, value)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs


class NestedWriteMixin:
    """Escrita aninhada por substituição: o payload contém a lista final."""

    nested_field = None

    @transaction.atomic
    def create(self, validated_data):
        children = validated_data.pop(self.nested_field, [])
        instance = self.Meta.model.objects.create(**validated_data)
        self._write_children(instance, children)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        # None: filhos ausentes no payload; []: apagar todos
        children = validated_data.pop(self.nested_field, None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if children is not None:
            self._write_children(instance, children)
        return instance

    def _write_children(self, instance, children):
        related = getattr(instance, self.nested_field)
        related.all().delete()
        for child in children:
            related.create(**child)


class MakerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Maker
        fields = ["id", "name", "hourly_rate"]


class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipment
        fields = [
            "id",
            "name",
            "category",
            "purchase_date",
            "value",
            "useful_life_months",
            "maintenance_status",
        ]


class ChannelFeeTierSerializer(serializers.ModelSerializer):
    # sem channel: a faixa só existe dentro do canal
    class Meta:
        model = ChannelFeeTier
        fields = ["id", "min_price", "commission_pct", "fixed_fee"]


class ChannelSerializer(NestedWriteMixin, serializers.ModelSerializer):
    nested_field = "fee_tiers"
    fee_tiers = ChannelFeeTierSerializer(many=True, required=False)

    class Meta:
        model = Channel
        fields = ["id", "name", "slug", "default_freight", "fee_tiers"]

    def validate_fee_tiers(self, value):
        # evita transformar a UniqueConstraint em IntegrityError/500
        prices = [tier["min_price"] for tier in value]
        if len(prices) != len(set(prices)):
            raise serializers.ValidationError(
                "Não repita o mesmo 'preço a partir de' no mesmo canal."
            )
        return value


class ComboItemSerializer(ModelCleanMixin, serializers.ModelSerializer):
    # sem combo: o componente só existe dentro do kit
    component_name = serializers.CharField(source="component.name", read_only=True)

    class Meta:
        model = ComboItem
        fields = ["id", "component", "component_name", "qty"]


class ProductSerializer(ModelCleanMixin, NestedWriteMixin, serializers.ModelSerializer):
    nested_field = "combo_items"
    combo_items = ComboItemSerializer(many=True, required=False)

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "category",
            "is_active",
            "is_combo",
            "material_cost",
            "packaging_cost",
            "waste_pct",
            "production_time_min",
            "batch_size",
            "maker",
            "target_margin_pct",
            "base_price",
            "combo_items",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        is_combo = attrs.get(
            "is_combo", self.instance.is_combo if self.instance else False
        )
        if attrs.get("combo_items") and not is_combo:
            raise serializers.ValidationError(
                {"combo_items": "Só um produto marcado como kit pode ter componentes."}
            )
        return attrs

    def to_representation(self, instance):
        # calcula o COGS uma vez e reaproveita a precisão cheia no preço sugerido
        data = super().to_representation(instance)
        cogs = unit_cogs(instance)
        data["cogs"] = {key: str(q2(value)) for key, value in cogs.items()}
        data["suggested_price"] = str(
            suggested_price(cogs["total"], instance.target_margin_pct)
        )
        return data
