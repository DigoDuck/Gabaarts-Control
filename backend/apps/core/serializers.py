"""Serializers da API: validam entrada e transportam dados.

Nenhuma regra de negócio nasce aqui: regras existentes vêm do clean() dos
models, via ModelCleanMixin, ou dos services.
"""

import copy
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from .models import (
    Channel,
    ChannelFeeTier,
    ComboItem,
    Equipment,
    Maker,
    Product,
    Sale,
    SaleItem,
)
from .services.costing import q2, unit_cogs
from .services.pricing import suggested_price
from .services.sales import refresh_snapshots


def cost_payload(cogs, margin):
    """Formato único do custo na API: quem exibe COGS lê deste lugar."""
    return {
        "cogs": {key: str(q2(value)) for key, value in cogs.items()},
        "suggested_price": str(suggested_price(cogs["total"], margin)),
    }


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
        # combo_items no payload substitui os existentes; ausente na edição mantém
        if "combo_items" in attrs:
            items = attrs["combo_items"]
        elif self.instance is not None:
            items = list(self.instance.combo_items.all())
        else:
            items = []
        if items and not is_combo:
            raise serializers.ValidationError(
                {"combo_items": "Só um produto marcado como kit pode ter componentes."}
            )
        # arquitetura §1.4: kit é is_combo=True com 2+ componentes. Kit vazio ou
        # de um item só é a bagunça de combos que o sistema nasceu para corrigir.
        if is_combo and len(items) < 2:
            raise serializers.ValidationError(
                {"is_combo": "Um kit precisa de pelo menos dois componentes."}
            )
        return attrs

    def to_representation(self, instance):
        # calcula o COGS uma vez e reaproveita a precisão cheia no preço sugerido
        data = super().to_representation(instance)
        cogs = unit_cogs(instance)
        data.update(cost_payload(cogs, instance.target_margin_pct))
        return data


class ProductPreviewSerializer(ProductSerializer):
    """Mesmos campos do produto, sem NENHUMA validação entre campos.

    Sai o clean() do model e sai também a checagem de combo_items sem
    is_combo do ProductSerializer. Validação de campo (tipo, casas decimais,
    faixas) continua valendo. Um rascunho incoerente é inválido para salvar e
    ainda assim calculável para exibir; o POST real é que barra.
    """

    def validate(self, attrs):
        return attrs


class SaleItemSerializer(ModelCleanMixin, serializers.ModelSerializer):
    # snapshots são calculados por services/sales, nunca digitados pelo cliente
    product_name = serializers.CharField(source="product.name", read_only=True)
    unit_profit = serializers.DecimalField(
        max_digits=9, decimal_places=2, read_only=True
    )

    class Meta:
        model = SaleItem
        fields = [
            "id",
            "product",
            "product_name",
            "qty",
            "unit_price",
            "unit_freight",
            "unit_cogs",
            "unit_fee",
            "unit_profit",
        ]
        read_only_fields = ["unit_cogs", "unit_fee"]


class SaleSerializer(NestedWriteMixin, serializers.ModelSerializer):
    nested_field = "items"
    items = SaleItemSerializer(many=True, required=False)
    channel_name = serializers.CharField(source="channel.name", read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id",
            "date",
            "channel",
            "channel_name",
            "customer_name",
            "status",
            "items",
        ]

    @transaction.atomic
    def create(self, validated_data):
        sale = super().create(validated_data)
        refresh_snapshots(sale)
        return sale

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # venda é derivada dos itens: sem item não há receita nem lucro. A API é
        # o trust boundary — o front já barra, mas um script não pode criar nem
        # esvaziar uma venda por aqui (arquitetura §1, "não existe item avulso").
        creating = self.instance is None
        if creating and not attrs.get("items"):
            raise serializers.ValidationError(
                {"items": "A venda precisa de ao menos um item."}
            )
        if not creating and "items" in attrs and not attrs["items"]:
            raise serializers.ValidationError(
                {"items": "A venda precisa de ao menos um item."}
            )
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        # snapshot só é refeito quando o payload ALTERA canal ou itens, não quando
        # eles apenas vêm no corpo (arquitetura §1.3). Verificar ANTES do super():
        # NestedWriteMixin.update consome "items".
        channel_changed = (
            validated_data.get("channel", instance.channel) != instance.channel
        )
        items_changed = "items" in validated_data and self._items_changed(
            instance, validated_data["items"]
        )
        # itens idênticos NÃO podem ser reescritos: o delete+recreate do
        # NestedWriteMixin recongelaria o snapshot com os parâmetros de hoje.
        # Tirar "items" do payload evita o rewrite; refresh_snapshots ainda roda
        # nas linhas atuais se o canal mudou.
        if "items" in validated_data and not items_changed:
            validated_data.pop("items")
        sale = super().update(instance, validated_data)
        if channel_changed or items_changed:
            refresh_snapshots(sale)
        return sale

    @staticmethod
    def _items_changed(instance, incoming):
        """Compara os itens do payload com os salvos, posição a posição.

        Só o que a usuária digita entra na conta (produto, qtd, preço, frete);
        unit_cogs/unit_fee são congelados e não. Comparação posicional espelha
        o diff do front (sale-form.tsx); reordenar conta como mudança.
        """
        existing = list(instance.items.all())
        if len(existing) != len(incoming):
            return True
        # frete None no payload = "usar o padrão do canal", que é o que ficou
        # congelado na linha; resolver antes de comparar evita falso positivo
        default_freight = instance.channel.default_freight or Decimal("0")
        for old, new in zip(existing, incoming):
            freight = new.get("unit_freight")
            if freight is None:
                freight = default_freight
            if (
                old.product_id != new["product"].pk
                or old.qty != new["qty"]
                or old.unit_price != new["unit_price"]
                or old.unit_freight != freight
            ):
                return True
        return False

    def to_representation(self, instance):
        data = super().to_representation(instance)
        items = list(instance.items.all())
        total = sum((item.qty * item.unit_price for item in items), Decimal("0"))
        profit = sum((item.qty * item.unit_profit for item in items), Decimal("0"))
        data["total"] = str(q2(total))
        data["profit"] = str(q2(profit))
        return data


# percentuais são fração de 4 casas em todo o domínio (arquitetura §3.1)
PCT = Decimal("0.0001")


class SimulateInputSerializer(serializers.Serializer):
    """Entrada de POST /api/pricing/simulate/."""

    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    channel = serializers.PrimaryKeyRelatedField(queryset=Channel.objects.all())
    price = serializers.DecimalField(
        max_digits=9, decimal_places=2, min_value=Decimal("0.01")
    )
    freight = serializers.DecimalField(
        max_digits=9,
        decimal_places=2,
        min_value=Decimal("0"),
        required=False,
        allow_null=True,
    )


class TargetPriceInputSerializer(serializers.Serializer):
    """Entrada de POST /api/pricing/target-price/."""

    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    channel = serializers.PrimaryKeyRelatedField(queryset=Channel.objects.all())
    margin = serializers.DecimalField(
        max_digits=5,
        decimal_places=4,
        min_value=Decimal("0"),
        max_value=Decimal("0.99"),
    )
    freight = serializers.DecimalField(
        max_digits=9,
        decimal_places=2,
        min_value=Decimal("0"),
        required=False,
        allow_null=True,
    )
