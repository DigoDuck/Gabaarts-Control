from decimal import Decimal

from django.db import migrations

MAKERS = [("Rouseli", Decimal("12.00")), ("Filha", Decimal("10.00"))]

# (min_price, comissão como fração, taxa fixa) — arquitetura §2.1
CHANNELS = {
    "instagram": ("Instagram", [("0", "0", "0")]),
    "whatsapp": ("WhatsApp", [("0", "0", "0")]),
    "shopee": ("Shopee", [
        ("0", "0.50", "0"),
        ("8", "0.20", "4"),
        ("80", "0.14", "16"),
        ("100", "0.14", "20"),
        ("200", "0.14", "26"),
    ]),
    "site": ("Site", [("0", "0.05", "0")]),  # gateway provisório 5%, ajustar quando fechar (§6)
}


def seed(apps, schema_editor):
    Maker = apps.get_model("core", "Maker")
    Channel = apps.get_model("core", "Channel")
    ChannelFeeTier = apps.get_model("core", "ChannelFeeTier")
    for name, rate in MAKERS:
        Maker.objects.create(name=name, hourly_rate=rate)
    for slug, (name, tiers) in CHANNELS.items():
        channel = Channel.objects.create(name=name, slug=slug)
        for min_price, pct, fixed in tiers:
            ChannelFeeTier.objects.create(
                channel=channel,
                min_price=Decimal(min_price),
                commission_pct=Decimal(pct),
                fixed_fee=Decimal(fixed),
            )


class Migration(migrations.Migration):
    dependencies = [("core", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
