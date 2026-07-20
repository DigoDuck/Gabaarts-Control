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

## Deploy

O backend e o PostgreSQL rodam no Railway; o frontend roda na Vercel. O Docker
Compose continua sendo somente o ambiente de desenvolvimento.

| Variável | Plataforma | Uso |
|---|---|---|
| `DATABASE_URL` | Railway | conexão PostgreSQL em URL única |
| `SECRET_KEY` | Railway | obrigatória em produção, sem valor padrão |
| `ALLOWED_HOSTS` | Railway | domínio Railway, separado por vírgula |
| `CORS_ALLOWED_ORIGINS` | Railway | domínio Vercel, separado por vírgula; nunca `*` |
| `CSRF_TRUSTED_ORIGINS` | Railway | domínio Railway com `https://`, para o Admin em produção |
| `DJANGO_SETTINGS_MODULE` | Railway | `config.settings.prod` |
| `VITE_API_URL` | Vercel | URL base da API Railway, sem barra final |

Primeiro deploy:

1. Crie o serviço Railway com root directory `backend/`, adicione o PostgreSQL e
   configure as variáveis da tabela. Aponte `DATABASE_URL` para a URL fornecida
   pelo banco.
2. Faça o deploy do backend e copie a URL pública do Railway.
3. Crie o projeto Vercel com root directory `frontend/`, defina `VITE_API_URL`
   com a URL Railway e faça o deploy do frontend.
4. Volte ao Railway, preencha `CORS_ALLOWED_ORIGINS` com a URL Vercel e faça o
   redeploy do backend.
5. Crie usuários e tokens pelo Admin em produção e valide login e listagem de
   produtos no frontend.

O `backend/railway.json` usa Gunicorn, executa migrations no pré-deploy e coleta
os estáticos no build da imagem. Para simular localmente a imagem de produção:

```bash
docker build -t gabaarts-control-backend ./backend
docker run --rm -p 8011:8000 \
  -e DJANGO_SETTINGS_MODULE=config.settings.prod \
  -e SECRET_KEY=prod-check-secret-key-with-enough-length-and-entropy \
  -e ALLOWED_HOSTS=localhost \
  -e CSRF_TRUSTED_ORIGINS=https://localhost \
  -e CORS_ALLOWED_ORIGINS=https://app.example.com \
  gabaarts-control-backend gunicorn config.wsgi --bind 0.0.0.0:8000
```

Em outro terminal, valide os estáticos do Admin com:

```bash
curl -H "Host: localhost" -H "X-Forwarded-Proto: https" \
  http://localhost:8011/static/admin/css/base.css
```

## Testes

```bash
docker compose run --rm web pytest
```
