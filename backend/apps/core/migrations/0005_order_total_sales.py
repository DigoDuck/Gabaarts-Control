from decimal import Decimal

import django.core.validators
from django.db import migrations, models


def move_financial_values_to_sale(apps, schema_editor):
    Sale = apps.get_model("core", "Sale")
    SaleItem = apps.get_model("core", "SaleItem")

    for sale in Sale.objects.all().iterator():
        items = SaleItem.objects.filter(sale_id=sale.pk)
        sale.products_total = sum(
            (item.qty * item.unit_price for item in items), Decimal("0")
        )
        sale.channel_fee = sum(
            (item.qty * item.unit_fee for item in items), Decimal("0")
        )
        sale.legacy_freight_cost = sum(
            (
                item.qty * (item.unit_freight or Decimal("0"))
                for item in items
            ),
            Decimal("0"),
        )
        sale.shipping_amount = Decimal("0")
        sale.save(
            update_fields=[
                "products_total",
                "channel_fee",
                "legacy_freight_cost",
                "shipping_amount",
            ]
        )


class Migration(migrations.Migration):
    dependencies = [("core", "0004_alter_product_waste_pct")]

    operations = [
        migrations.AddField(
            model_name="sale",
            name="products_total",
            field=models.DecimalField(
                decimal_places=2, max_digits=11, null=True,
                verbose_name="total dos produtos (R$)",
            ),
        ),
        migrations.AddField(
            model_name="sale",
            name="shipping_amount",
            field=models.DecimalField(
                decimal_places=2, default=Decimal("0"), max_digits=11,
                validators=[django.core.validators.MinValueValidator(Decimal("0"))],
                verbose_name="frete cobrado (R$)",
            ),
        ),
        migrations.AddField(
            model_name="sale",
            name="channel_fee",
            field=models.DecimalField(
                decimal_places=2, default=Decimal("0"), max_digits=11,
                validators=[django.core.validators.MinValueValidator(Decimal("0"))],
                verbose_name="taxa do canal (R$)",
            ),
        ),
        migrations.AddField(
            model_name="sale",
            name="fee_source",
            field=models.CharField(
                choices=[("suggested", "Sugerida"), ("manual", "Informada")],
                default="suggested", max_length=10, verbose_name="origem da taxa",
            ),
        ),
        migrations.AddField(
            model_name="sale",
            name="legacy_freight_cost",
            field=models.DecimalField(
                decimal_places=2, default=Decimal("0"), editable=False,
                max_digits=11,
                validators=[django.core.validators.MinValueValidator(Decimal("0"))],
                verbose_name="frete histórico (R$)",
            ),
        ),
        migrations.RunPython(move_financial_values_to_sale, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="sale",
            name="products_total",
            field=models.DecimalField(
                decimal_places=2, max_digits=11,
                validators=[django.core.validators.MinValueValidator(Decimal("0.01"))],
                verbose_name="total dos produtos (R$)",
            ),
        ),
        migrations.AlterField(
            model_name="saleitem",
            name="unit_price",
            field=models.DecimalField(
                blank=True, decimal_places=2, editable=False, max_digits=9,
                null=True, verbose_name="preço unitário legado (R$)",
            ),
        ),
        migrations.AlterField(
            model_name="saleitem",
            name="unit_fee",
            field=models.DecimalField(
                blank=True, decimal_places=2, editable=False, max_digits=9,
                null=True, verbose_name="taxa unitária legada (R$)",
            ),
        ),
        migrations.AlterField(
            model_name="saleitem",
            name="unit_freight",
            field=models.DecimalField(
                blank=True, decimal_places=2, editable=False, max_digits=9,
                null=True, verbose_name="frete unitário legado (R$)",
            ),
        ),
    ]
