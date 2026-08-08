from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


pytestmark = pytest.mark.django_db(transaction=True)


def test_migration_preserves_historical_revenue_and_profit():
    executor = MigrationExecutor(connection)
    old_target = [("core", "0004_alter_product_waste_pct")]
    executor.migrate(old_target)
    old_apps = executor.loader.project_state(old_target).apps

    Channel = old_apps.get_model("core", "Channel")
    Product = old_apps.get_model("core", "Product")
    Sale = old_apps.get_model("core", "Sale")
    SaleItem = old_apps.get_model("core", "SaleItem")

    channel = Channel.objects.get(slug="shopee")
    product = Product.objects.create(name="Caneca")
    sale = Sale.objects.create(date=date(2026, 7, 10), channel=channel)
    SaleItem.objects.create(
        sale=sale,
        product=product,
        qty=1,
        unit_price=Decimal("40.00"),
        unit_cogs=Decimal("15.16"),
        unit_fee=Decimal("12.00"),
        unit_freight=Decimal("2.00"),
    )

    new_target = [("core", "0005_order_total_sales")]
    executor = MigrationExecutor(connection)
    executor.migrate(new_target)
    new_apps = executor.loader.project_state(new_target).apps
    migrated = new_apps.get_model("core", "Sale").objects.get(pk=sale.pk)

    assert migrated.products_total == Decimal("40.00")
    assert migrated.channel_fee == Decimal("12.00")
    assert migrated.legacy_freight_cost == Decimal("2.00")
    assert migrated.shipping_amount == Decimal("0.00")
