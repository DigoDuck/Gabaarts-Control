# base: dependências de runtime, compartilhada por dev e prod
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# dev: soma pytest e afins; usada pelo docker-compose local
FROM base AS dev
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY . .

# prod: sem dev deps; stage final, é o que o Railway builda por padrão
FROM base AS prod
COPY . .
# SECRET_KEY/ALLOWED_HOSTS são dummies só para o collectstatic no build; prod real usa os do Railway
RUN DJANGO_SETTINGS_MODULE=config.settings.prod SECRET_KEY=build-only-dummy ALLOWED_HOSTS=build python manage.py collectstatic --noinput
