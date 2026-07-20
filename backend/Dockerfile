FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt requirements-dev.txt ./
# imagem de dev instala os dois; a de prod usará só requirements.txt quando o deploy for decidido
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY . .
