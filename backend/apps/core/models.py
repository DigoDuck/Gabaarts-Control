from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Maker(models.Model):
    name = models.CharField("nome", max_length=100)
    hourly_rate = models.DecimalField("custo por hora (R$)", max_digits=9, decimal_places=2)

    class Meta:
        verbose_name = "artesã"
        verbose_name_plural = "artesãs"

    def __str__(self):
        return self.name


class Product(models.Model):
    class Category(models.TextChoices):
        GIFTS = "gifts", "Presentes"
        STATIONERY = "stationery", "Papelaria"
        MEMORIES = "memories", "Memórias"
        SCHOOL = "school", "Escolar"
        OTHER = "other", "Outros"

    name = models.CharField("nome", max_length=120)
    category = models.CharField(
        "categoria", max_length=20, choices=Category.choices, default=Category.OTHER
    )
    is_active = models.BooleanField("ativo", default=True)
    is_combo = models.BooleanField("é kit", default=False)
    # custo
    material_cost = models.DecimalField(
        "custo de material (R$)", max_digits=9, decimal_places=2, default=Decimal("0")
    )
    packaging_cost = models.DecimalField(
        "custo de embalagem (R$)", max_digits=9, decimal_places=2, default=Decimal("0")
    )
    waste_pct = models.DecimalField(
        "perda sobre material (fração)", max_digits=5, decimal_places=4,
        default=Decimal("0"), validators=[MinValueValidator(Decimal("0"))],
    )
    production_time_min = models.PositiveIntegerField("tempo de produção (min/lote)", default=0)
    batch_size = models.PositiveIntegerField(
        "tamanho do lote", default=1, validators=[MinValueValidator(1)]
    )
    maker = models.ForeignKey(
        Maker, verbose_name="artesã", on_delete=models.PROTECT, null=True, blank=True
    )
    # comercial
    target_margin_pct = models.DecimalField(
        "margem-alvo (fração)", max_digits=5, decimal_places=4, default=Decimal("0.5"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("0.99"))],
    )
    base_price = models.DecimalField(
        "preço base (R$)", max_digits=9, decimal_places=2, null=True, blank=True
    )

    class Meta:
        verbose_name = "produto"
        verbose_name_plural = "produtos"

    def __str__(self):
        return self.name

    def clean(self):
        if self.production_time_min and self.maker_id is None:
            raise ValidationError(
                {"maker": "Produto com tempo de produção precisa de artesã."}
            )


class ComboItem(models.Model):
    combo = models.ForeignKey(
        Product, verbose_name="kit", on_delete=models.CASCADE, related_name="combo_items"
    )
    component = models.ForeignKey(
        Product, verbose_name="componente", on_delete=models.PROTECT,
        related_name="used_in_combos",
    )
    qty = models.PositiveIntegerField("quantidade", default=1, validators=[MinValueValidator(1)])

    class Meta:
        verbose_name = "componente do kit"
        verbose_name_plural = "componentes do kit"

    def clean(self):
        errors = {}
        # guards com *_id: no inline do Admin o FK pai pode ainda não estar setado
        if self.combo_id and not self.combo.is_combo:
            errors["combo"] = "Só um produto marcado como kit pode ter componentes."
        if self.component_id and self.component.is_combo:
            errors["component"] = "Kit dentro de kit não é suportado (arquitetura §1.4)."
        if errors:
            raise ValidationError(errors)


class Channel(models.Model):
    name = models.CharField("nome", max_length=50)
    slug = models.SlugField("identificador", unique=True)
    default_freight = models.DecimalField(
        "frete padrão (R$/un)", max_digits=9, decimal_places=2, null=True, blank=True
    )

    class Meta:
        verbose_name = "canal"
        verbose_name_plural = "canais"

    def __str__(self):
        return self.name


class ChannelFeeTier(models.Model):
    channel = models.ForeignKey(
        Channel, verbose_name="canal", on_delete=models.CASCADE, related_name="fee_tiers"
    )
    min_price = models.DecimalField("preço a partir de (R$)", max_digits=9, decimal_places=2)
    commission_pct = models.DecimalField("comissão (fração)", max_digits=5, decimal_places=4)
    fixed_fee = models.DecimalField("taxa fixa (R$)", max_digits=9, decimal_places=2)

    class Meta:
        verbose_name = "faixa de taxa"
        verbose_name_plural = "faixas de taxa"
        ordering = ["channel", "min_price"]
        constraints = [
            models.UniqueConstraint(
                fields=["channel", "min_price"], name="unique_tier_per_channel_price"
            )
        ]

    def __str__(self):
        return f"{self.channel} ≥ {self.min_price}"


class Sale(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        COMPLETED = "completed", "Concluída"
        CANCELED = "canceled", "Cancelada"

    date = models.DateField("data")
    channel = models.ForeignKey(Channel, verbose_name="canal", on_delete=models.PROTECT)
    customer_name = models.CharField("cliente", max_length=120, blank=True)
    # default completed: o fluxo real é registrar venda já feita (planilha: 11 de 11 concluídas)
    status = models.CharField(
        "situação", max_length=10, choices=Status.choices, default=Status.COMPLETED
    )

    class Meta:
        verbose_name = "venda"
        verbose_name_plural = "vendas"

    def __str__(self):
        return f"{self.date} · {self.channel}"


class SaleItem(models.Model):
    sale = models.ForeignKey(
        Sale, verbose_name="venda", on_delete=models.CASCADE, related_name="items"
    )
    product = models.ForeignKey(Product, verbose_name="produto", on_delete=models.PROTECT)
    qty = models.PositiveIntegerField("quantidade", default=1, validators=[MinValueValidator(1)])
    unit_price = models.DecimalField("preço unitário (R$)", max_digits=9, decimal_places=2)
    # snapshots congelados na criação/edição da venda (arquitetura §1.3) — lucro deriva SÓ deles
    unit_cogs = models.DecimalField(
        "custo unitário (R$)", max_digits=9, decimal_places=2, default=Decimal("0")
    )
    unit_fee = models.DecimalField(
        "taxa unitária (R$)", max_digits=9, decimal_places=2, default=Decimal("0")
    )
    # nullable = "ainda não informado": o snapshot preenche com o default do canal
    unit_freight = models.DecimalField(
        "frete unitário (R$)", max_digits=9, decimal_places=2, null=True, blank=True
    )

    class Meta:
        verbose_name = "item da venda"
        verbose_name_plural = "itens da venda"

    def __str__(self):
        return f"{self.qty}× {self.product}"

    def clean(self):
        errors = {}
        if self.unit_price is not None and self.unit_price <= 0:
            errors["unit_price"] = "Preço deve ser maior que zero."
        if self.product_id and not self.product.is_active:
            errors["product"] = "Produto inativo não pode ser vendido."
        if errors:
            raise ValidationError(errors)

    @property
    def unit_profit(self):
        return self.unit_price - self.unit_cogs - self.unit_fee - (self.unit_freight or Decimal("0"))


class Equipment(models.Model):
    # espelho da aba Equipamentos da planilha, zero lógica;
    # depreciação/mês é derivada e fica para o módulo financeiro futuro (arquitetura §4)
    name = models.CharField("equipamento", max_length=120)
    category = models.CharField("categoria", max_length=50, blank=True)
    purchase_date = models.DateField("data de aquisição", null=True, blank=True)
    value = models.DecimalField(
        "valor pago (R$)", max_digits=9, decimal_places=2, null=True, blank=True
    )
    useful_life_months = models.PositiveIntegerField("vida útil (meses)", null=True, blank=True)
    maintenance_status = models.CharField(
        "status manutenção", max_length=50, blank=True, default="Em dia"
    )

    class Meta:
        verbose_name = "equipamento"
        verbose_name_plural = "equipamentos"

    def __str__(self):
        return self.name
