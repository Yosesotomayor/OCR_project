FROM python:3.11-slim-bookworm
LABEL name="LeaseLens-ML-Service-Paddle"

# 1. Configuración de entorno crítica para evitar crashes binarios
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1 \
    PADDLE_HOME=/app/.paddleocr \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libgomp.so.1

WORKDIR /app

# 2. Instalación de dependencias de sistema (Headless OCR + LibGOMP)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libgomp1 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 3. Inyectar uv para gestión ultra-rápida de paquetes
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# 4. Instalación de dependencias desde pyproject.toml
COPY ml-service/pyproject.toml ml-service/uv.lock ./
RUN uv pip install --no-cache .

# 5. Crear usuario no-root ANTES de usarlo
RUN groupadd -r paddleuser && useradd -r -m -g paddleuser paddleuser \
    && mkdir -p $PADDLE_HOME && chown -R paddleuser:paddleuser /app

# 6. Copiar código fuente y pre-descargar modelos
COPY ml-service/src ./src
RUN python src/download_models.py

# 7. Finalizar configuración de seguridad
USER paddleuser

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
