# Gabaarts Control

API interna de gestão comercial da Gabaarts (produtos personalizados): custos, precificação por canal, vendas e margem de contribuição. Substitui a planilha oficial do negócio. Não é e-commerce.

- **Stack:** Django 5 + DRF + PostgreSQL; Django Admin como interface de cadastro; React (fase 2) para dashboards internos.
- **Arquitetura:** [docs/arquitetura.md](docs/arquitetura.md) — modelo de domínio, motor de taxas por canal, precificação e faseamento.
- **Status:** fase 1 (models + Admin + services + testes) implementada; DRF e React entram na fase 2 (docs/arquitetura.md §4).

## Como rodar

```bash
cp .env.example .env          # ajustar a senha do Postgres
docker compose build
docker compose run --rm web python manage.py migrate
docker compose run --rm web python manage.py createsuperuser
docker compose up
# Admin: http://localhost:8000/admin/
```

## Testes

```bash
docker compose run --rm web pytest
```
