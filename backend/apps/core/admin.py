from decimal import Decimal

from django.contrib import admin

from .models import (
    Channel, ChannelFeeTier, ComboItem, Equipment, Maker, Product, Sale, SaleItem,
)
from .services.costing import q2, unit_cogs
from .services.pricing import margin_on_price, margin_status, suggested_price
from .services.sales import refresh_snapshots

admin.site.site_header = "Gabaarts Control"
admin.site.site_title = "Gabaarts Control"
admin.site.index_title = "Gestão"


@admin.register(Maker)
class MakerAdmin(admin.ModelAdmin):
    list_display = ["name", "hourly_rate"]


class ComboItemInline(admin.TabularInline):
    model = ComboItem
    fk_name = "combo"
    extra = 0


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "is_active", "is_combo",
                    "cogs_display", "suggested_price_display"]
    list_filter = ["category", "is_active", "is_combo"]
    search_fields = ["name"]
    inlines = [ComboItemInline]
    readonly_fields = ["cogs_breakdown", "suggested_price_display", "base_price_status"]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("maker")

    @admin.display(description="COGS (R$)")
    def cogs_display(self, obj):
        return q2(unit_cogs(obj)["total"])

    @admin.display(description="COGS decomposto")
    def cogs_breakdown(self, obj):
        if obj is None or obj.pk is None:
            return "—"
        c = unit_cogs(obj)
        return (f"material R$ {q2(c['material'])} + mão de obra R$ {q2(c['labor'])} "
                f"+ embalagem R$ {q2(c['packaging'])} = R$ {q2(c['total'])}")

    @admin.display(description="preço sugerido (R$)")
    def suggested_price_display(self, obj):
        if obj is None or obj.pk is None:
            return "—"
        return suggested_price(unit_cogs(obj)["total"], obj.target_margin_pct)

    @admin.display(description="situação do preço base vs meta")
    def base_price_status(self, obj):
        if obj is None or obj.pk is None or not obj.base_price:
            return "—"
        # margem no preço base em canal direto (taxa 0); por canal é a simulação (fase 2)
        margin = margin_on_price(obj.base_price - unit_cogs(obj)["total"], obj.base_price)
        label = margin_status(margin, obj.target_margin_pct)
        return f"margem {q2(margin * 100)}% no canal direto (sem taxa) — {label}"


class ChannelFeeTierInline(admin.TabularInline):
    model = ChannelFeeTier
    extra = 0


@admin.register(Channel)
class ChannelAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "default_freight"]
    inlines = [ChannelFeeTierInline]


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 1
    # venda sem item não tem receita nem lucro; o serializer barra na API e o
    # Admin (fallback técnico) barra aqui
    min_num = 1
    fields = ["product", "qty", "unit_price", "unit_freight",
              "unit_cogs", "unit_fee", "unit_profit_display", "status_vs_target"]
    readonly_fields = ["unit_cogs", "unit_fee", "unit_profit_display", "status_vs_target"]

    @admin.display(description="lucro unit. (R$)")
    def unit_profit_display(self, obj):
        if obj is None or obj.pk is None:
            return "—"
        return obj.unit_profit

    @admin.display(description="situação vs meta")
    def status_vs_target(self, obj):
        if obj is None or obj.pk is None or not obj.unit_price:
            return "—"
        margin = margin_on_price(obj.unit_profit, obj.unit_price)
        label = margin_status(margin, obj.product.target_margin_pct)
        return f"margem {q2(margin * 100)}% — {label}"


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ["date", "channel", "customer_name", "status",
                    "total_display", "profit_display"]
    list_filter = ["channel", "status"]
    date_hierarchy = "date"
    inlines = [SaleItemInline]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("channel").prefetch_related("items")

    def save_related(self, request, form, formsets, change):
        # mesma regra da API (serializers.SaleSerializer.update): o snapshot só
        # é refeito quando a edição mexe no que entra na conta. Corrigir cliente
        # ou situação não pode re-precificar uma venda antiga.
        recalculates = "channel" in form.changed_data or any(
            formset.has_changed() for formset in formsets
        )
        super().save_related(request, form, formsets, change)
        if not change or recalculates:
            refresh_snapshots(form.instance)

    @admin.display(description="total (R$)")
    def total_display(self, obj):
        return sum((i.qty * i.unit_price for i in obj.items.all()), Decimal("0"))

    @admin.display(description="lucro (R$)")
    def profit_display(self, obj):
        return sum((i.qty * i.unit_profit for i in obj.items.all()), Decimal("0"))


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "value", "purchase_date", "maintenance_status"]
