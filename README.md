# Gabaarts Control

API interna de gestão comercial da Gabaarts (produtos personalizados): custos, precificação por canal, vendas e margem de contribuição. Substitui a planilha oficial do negócio. Não é e-commerce.

- **Stack:** Django 5 + DRF + PostgreSQL; Django Admin como interface de cadastro; React (fase 2) para dashboards internos.
- **Arquitetura:** [docs/arquitetura.md](docs/arquitetura.md) — modelo de domínio, motor de taxas por canal, precificação e faseamento.
- **Status:** fase 1 e API DRF da fase 2a implementadas; React entra nas fases 2b e 2c (docs/arquitetura.md §4).

## Como rodar

```bash
cp .env.example .env          # ajustar a senha do Postgres
docker compose build
docker compose run --rm web python manage.py migrate
docker compose run --rm web python manage.py createsuperuser
docker compose up
# Admin: http://localhost:8000/admin/
```

## API (fase 2a)

Todas as rotas exigem autenticação. Gere um token no Admin (Tokens) ou via:

```bash
curl -X POST http://localhost:8000/api/auth/token/ \
     -d "username=<usuario>&password=<senha>"
```

Use-o em todas as chamadas: `-H "Authorization: Token <TOKEN>"`.

| Rota | Método | O quê |
|---|---|---|
| `/api/auth/token/` | POST | troca usuário e senha por token |
| `/api/products/` | CRUD | catálogo; resposta traz `cogs` decomposto e `suggested_price`; kits em `combo_items` |
| `/api/channels/` | CRUD | canais com `fee_tiers` aninhadas |
| `/api/makers/` · `/api/equipment/` | CRUD | artesãs e equipamentos |
| `/api/sales/?from=&to=&channel=` | CRUD | vendas com `items` aninhados; snapshot congelado no create/update |
| `/api/pricing/simulate/` | POST | `{product, channel, price, freight?}` → taxa, lucro, margem, situação vs meta |
| `/api/pricing/target-price/` | POST | `{product, channel, margin, freight?}` → preço, faixa usada, avisos de zona morta |
| `/api/reports/summary/?from=&to=&channel=` | GET | receita, lucro, ticket médio, nº de vendas, quebra por canal |

Dinheiro trafega como **string** (`"15.16"`), nunca como número: float perde centavo.
Sem paginação: o volume atual cabe em uma resposta.

Dependências de desenvolvimento (pytest) ficam em `backend/requirements-dev.txt`;
`backend/requirements.txt` tem somente o runtime.

## Testes

```bash
docker compose run --rm web pytest
```
