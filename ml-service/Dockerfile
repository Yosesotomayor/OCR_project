FROM python:3.11-slim-bookworm AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY ml-service/pyproject.toml ml-service/uv.lock ./

RUN uv sync --frozen --no-cache --no-install-project

FROM python:3.11-slim-bookworm
LABEL name="LeaseLens-ML-Service"

WORKDIR /app

# Instalar dependencias de sistema necesarias para OpenCV/EasyOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.venv /app/.venv

COPY ml-service/src /app/src

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Pre-descargar modelos de EasyOCR para evitar demoras en runtime
RUN python -c "import easyocr; easyocr.Reader(['es', 'en'])"

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
