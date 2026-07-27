"""Popula o banco a partir da planilha Gabaarts_Oficial (Drive).

Idempotente: roda quantas vezes quiser. Cadastro (artesãs, canais, produtos,
equipamentos) usa update_or_create — reexecutar atualiza, nunca duplica.
Vendas só são criadas se ainda não houver nenhuma; --reset-sales apaga e recria.

Fonte: planilha Gabaarts_Oficial, abas Parâmetros / Custo Unitário /
Precificação / Canais de Venda / Vendas / Equipamentos (jul/2026).

SUPOSIÇÕES marcadas com # CONFIRMAR são escolhas minhas onde a planilha era
ambígua ou não tinha o dado. Revise antes de rodar em produção.
"""
from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.models import (
    Channel,
    ChannelFeeTier,
    ComboItem,
    Equipment,
    Maker,
    Product,
    Sale,
    SaleItem,
)
from apps.core.services.sales import refresh_snapshots

D = Decimal
SALE_DATE = date(2026, 7, 1)  # planilha só diz "jul/2026", sem dia

# --- Artesãs (aba Parâmetros) — já vêm da migration 0002; aqui só garante a taxa
MAKERS = {"Rouseli": D("12.00"), "Filha": D("10.00")}

# --- Canais que faltam (ML e TikTok não estão na migration 0002).
# (min_price, comissão fração, taxa fixa). ML em 3 faixas reproduz a regra da
# planilha: fixo de R$6 só entre R$12,50 e R$79; zero fora disso.
CHANNELS = {
    "mercado-livre": ("Mercado Livre", D("0.00"), [
        ("0", "0.14", "0"),
        ("12.50", "0.14", "6"),
        ("79", "0.14", "0"),
    ]),
    "tiktok": ("TikTok Shop", D("0.00"), [("0", "0.06", "0")]),
}

# --- Produtos do catálogo (abas Custo Unitário + Precificação)
# nome, categoria, material, tempo_min, artesã, embalagem, margem_alvo, preço_praticado
PRODUCTS = [
    ("Canecas personalizadas", "gifts", "10.49", 10, "Filha", "3.00", "0.50", "38.00"),
    ("Ímãs personalizados", "gifts", "2.70", 5, "Filha", "3.00", "0.50", "13.00"),
    ("Chaveiros personalizados", "gifts", "2.50", 5, "Rouseli", "3.00", "0.50", "10.00"),
    ("Bottons personalizados", "gifts", "1.50", 8, "Filha", "1.50", "0.50", "6.00"),
    ("Caderno 1 matéria", "stationery", "31.50", 60, "Filha", "5.00", "0.20", "60.00"),
    ("Caderno 10 matérias", "stationery", "39.60", 80, "Rouseli", "5.00", "0.50", None),
    ("Caderno 15 matérias", "stationery", "49.20", 90, "Rouseli", "5.00", "0.50", None),
    ("Caderno 20 matérias", "stationery", "55.60", 100, "Filha", "5.00", "0.25", "100.00"),
    ("Agenda simples", "stationery", "26.40", 60, "Rouseli", "5.00", "0.50", None),
    ("Agenda clássica", "stationery", "31.60", 80, "Rouseli", "5.00", "0.50", None),
    ("Agenda luxo", "stationery", "36.50", 100, "Rouseli", "5.00", "0.50", None),
    ("Caderneta de saúde", "stationery", "39.45", 80, "Filha", "5.00", "0.50", "75.00"),
    ("Caderneta de gestante", "stationery", "39.45", 80, "Rouseli", "5.00", "0.50", None),
    # CONFIRMAR: planilha deixou categoria em branco em Álbuns/Azulejo/Relógio.
    # Classifiquei os fotográficos como "memories".
    ("Álbum do bebê", "memories", "59.25", 90, "Rouseli", "5.00", "0.50", "90.00"),
    ("Álbum de Foto", "memories", "59.25", 90, "Rouseli", "5.00", "0.50", "130.00"),
    ("Etiquetas escolares/Adesivo", "school", "2.00", 5, "Rouseli", "3.00", "0.50", "15.00"),
    ("Tabuadas chaveiro", "school", "3.90", 20, "Rouseli", "3.00", "0.50", "15.00"),
    ("Azulejo", "memories", "13.30", 15, "Rouseli", "5.00", "0.50", "39.99"),  # CONFIRMAR categoria
    ("Relógio", "memories", "14.30", 20, "Rouseli", "5.00", "0.50", "49.99"),  # CONFIRMAR categoria
]

# --- Produtos que aparecem só em Vendas, sem custo na aba Custo Unitário.
# nome, categoria, material (=COGS, sem tempo/artesã), preço_praticado, nota
EXTRA_PRODUCTS = [
    # Custo do lote informado manual (R$58) na planilha; NÃO é 20× o botton
    # avulso (economia de lote é outra). Modelado como custo direto.
    ("Kit 20 bottons", "gifts", "58.00", "100.00",
     "custo do lote = R$58 (manual na planilha), não 20× botton avulso"),
    # CONFIRMAR: sem custo medido. Usei R$18 (custo manual da linha 'Topper de
    # bolo' da Monica). Unifiquei 'Topo de bolo' e 'Topper de bolo' no mesmo item.
    ("Topo de bolo", "other", "18.00", "15.00",
     "custo estimado R$18 (linha Topper/Monica); CONFIRMAR"),
    # Fora daqui de propósito: 'Impressão papel fotográfico', 'Caneca Polimero'
    # e 'Tags adesivas' não têm custo medido. Serão cadastrados no site depois,
    # com o cálculo de custo unitário (as vendas deles também ficam de fora).
]

# --- Combos (is_combo) — custo deriva dos componentes.
# nome, categoria, preço_praticado, [(componente, qtd)], nota
COMBOS = [
    ("Caneca + Chaveiro", "gifts", "50.00",
     [("Canecas personalizadas", 1), ("Chaveiros personalizados", 1)], ""),
    # CONFIRMAR: qual agenda? Assumi "Agenda simples" (mais barata, plausível p/ kit de R$65).
    ("Kit agenda + botton", "stationery", "65.00",
     [("Agenda simples", 1), ("Bottons personalizados", 1)], "CONFIRMAR agenda: assumi simples"),
]

# --- Equipamentos (aba Equipamentos)
# nome, categoria, valor (None = em branco na planilha)
EQUIPMENT = [
    ("Impressora sublimação", "Impressão", "1000.00"),
    ("Impressora papelaria", "Impressão", "100.00"),
    ("Máquina de recorte", "Acabamento", "2600.00"),
    ("Laminadora/plastificadora", "Acabamento", "190.00"),
    ("Prensa de caneca", "Prensa", "550.00"),
    ("Máquina de bottons", "Prensa", "450.00"),
    ("Máquina de foto ímã", "Prensa", "550.00"),
    ("Encadernadora espiral", "Acabamento", "550.00"),
    ("Notebook", "Eletrônicos", None),
]

# --- Vendas (aba Vendas). Todas WhatsApp, jul/2026, Concluída.
# produto, qtd, preço_unit, cliente
SALES = [
    ("Bottons personalizados", 4, "10.00", ""),
    ("Caneca + Chaveiro", 1, "50.00", ""),
    ("Topo de bolo", 1, "15.00", ""),
    ("Kit agenda + botton", 1, "65.00", ""),
    ("Azulejo", 2, "40.00", ""),
    ("Ímãs personalizados", 1, "13.00", ""),
    ("Etiquetas escolares/Adesivo", 1, "16.00", ""),
    ("Canecas personalizadas", 1, "38.00", ""),
    ("Chaveiros personalizados", 1, "10.00", ""),
    ("Kit 20 bottons", 1, "100.00", ""),
    ("Azulejo", 2, "40.00", "Romilda"),
    ("Relógio", 1, "50.00", "Romilda"),
    ("Topo de bolo", 1, "18.00", "Monica"),  # 'Topper de bolo' unificado em 'Topo de bolo'
    ("Canecas personalizadas", 2, "38.00", "Gil"),
]


class Command(BaseCommand):
    help = "Popula o banco com os dados da planilha Gabaarts_Oficial (idempotente)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-sales", action="store_true",
            help="Apaga todas as vendas e recria (senão, só cria se não houver nenhuma).",
        )
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Roda tudo numa transação e faz rollback no fim (valida sem persistir).",
        )

    def handle(self, *args, **options):
        dry = options["dry_run"]
        try:
            with transaction.atomic():
                self._seed(options["reset_sales"])
                if dry:
                    self.stdout.write(self.style.WARNING("\n--dry-run: rollback, nada persistido."))
                    raise _Rollback()
        except _Rollback:
            pass

    def _seed(self, reset_sales):
        makers = self._makers()
        self._channels()
        products = self._catalog(makers)
        self._equipment()
        self._sales(products, reset_sales)

    def _makers(self):
        out = {}
        for name, rate in MAKERS.items():
            out[name], _ = Maker.objects.update_or_create(
                name=name, defaults={"hourly_rate": rate}
            )
        self.stdout.write(f"Artesãs: {len(out)} garantidas.")
        return out

    def _channels(self):
        for slug, (name, freight, tiers) in CHANNELS.items():
            ch, _ = Channel.objects.update_or_create(
                slug=slug, defaults={"name": name, "default_freight": freight}
            )
            ch.fee_tiers.all().delete()  # re-sync das faixas
            for min_price, pct, fixed in tiers:
                ChannelFeeTier.objects.create(
                    channel=ch, min_price=D(min_price),
                    commission_pct=D(pct), fixed_fee=D(fixed),
                )
        self.stdout.write(f"Canais: {len(CHANNELS)} sincronizados (+ os da migration).")

    def _catalog(self, makers):
        products = {}
        for name, cat, mat, t, maker, pack, margin, price in PRODUCTS:
            products[name], _ = Product.objects.update_or_create(
                name=name,
                defaults={
                    "category": cat, "is_active": True, "is_combo": False,
                    "material_cost": D(mat), "packaging_cost": D(pack),
                    "waste_pct": D("0"), "production_time_min": t, "batch_size": 1,
                    "maker": makers[maker], "target_margin_pct": D(margin),
                    "base_price": D(price) if price else None,
                },
            )
        for name, cat, cost, price, _note in EXTRA_PRODUCTS:
            products[name], _ = Product.objects.update_or_create(
                name=name,
                defaults={
                    "category": cat, "is_active": True, "is_combo": False,
                    "material_cost": D(cost), "packaging_cost": D("0"),
                    "waste_pct": D("0"), "production_time_min": 0, "batch_size": 1,
                    "maker": None, "target_margin_pct": D("0.50"),
                    "base_price": D(price) if price else None,
                },
            )
        for name, cat, price, comps, _note in COMBOS:
            combo, _ = Product.objects.update_or_create(
                name=name,
                defaults={
                    "category": cat, "is_active": True, "is_combo": True,
                    "material_cost": D("0"), "packaging_cost": D("0"),
                    "waste_pct": D("0"), "production_time_min": 0, "batch_size": 1,
                    "maker": None, "target_margin_pct": D("0.50"),
                    "base_price": D(price) if price else None,
                },
            )
            combo.combo_items.all().delete()  # re-sync dos componentes
            for comp_name, qty in comps:
                ComboItem.objects.create(combo=combo, component=products[comp_name], qty=qty)
            products[name] = combo
        self.stdout.write(
            f"Produtos: {len(PRODUCTS)} do catálogo + {len(EXTRA_PRODUCTS)} extras "
            f"+ {len(COMBOS)} combos."
        )
        return products

    def _equipment(self):
        for name, cat, value in EQUIPMENT:
            Equipment.objects.update_or_create(
                name=name,
                defaults={
                    "category": cat,
                    "value": D(value) if value else None,
                    "maintenance_status": "Em dia",
                },
            )
        self.stdout.write(f"Equipamentos: {len(EQUIPMENT)} garantidos.")

    def _sales(self, products, reset_sales):
        if reset_sales:
            Sale.objects.all().delete()
        elif Sale.objects.exists():
            self.stdout.write(self.style.WARNING(
                "Vendas já existem; pulei (use --reset-sales para recriar)."
            ))
            return
        whatsapp = Channel.objects.get(slug="whatsapp")
        for prod_name, qty, price, customer in SALES:
            sale = Sale.objects.create(
                date=SALE_DATE, channel=whatsapp, customer_name=customer,
                status=Sale.Status.COMPLETED,
            )
            SaleItem.objects.create(
                sale=sale, product=products[prod_name], qty=qty, unit_price=D(price),
            )
            refresh_snapshots(sale)  # congela unit_cogs/unit_fee/unit_freight
        self.stdout.write(f"Vendas: {len(SALES)} criadas (snapshots congelados).")


class _Rollback(Exception):
    """Sinaliza rollback do --dry-run sem vazar erro real."""
