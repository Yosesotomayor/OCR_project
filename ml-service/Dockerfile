FROM python:3.11-slim-bookworm AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# 1. Instalar dependencias de compilación completas
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    libpq-dev \
    g++ \
    make \
    cmake \
    && rm -rf /var/lib/apt/lists/*

COPY ml-service/pyproject.toml ml-service/uv.lock ./

# 2. Sincronizar dependencias (uv creará el .venv)
RUN uv sync --frozen --no-install-project

FROM python:3.11-slim-bookworm
LABEL name="LeaseLens-ML-Service-Paddle"

WORKDIR /app

# 3. Dependencias de sistema para ejecución (PaddleOCR + OpenCV)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# 4. Copiar el entorno virtual y configurar el PATH
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"
ENV VIRTUAL_ENV="/app/.venv"

# --- EL SECRETO DEL TURBO BUILD ---
# 5. Pre-descargar modelos usando el python del venv
# Forzamos que use el binario del venv para encontrar paddleocr
RUN /app/.venv/bin/python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='es', use_gpu=False)"

# 6. Finalmente copiar el código
COPY ml-service/src /app/src

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
