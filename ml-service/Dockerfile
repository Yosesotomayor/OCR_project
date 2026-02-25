FROM python:3.11-slim-bookworm
LABEL name="OCR Project - ML Service"

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    poppler-utils \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY ml-service/pyproject.toml ml-service/uv.lock ./

COPY shared /app/shared 

RUN uv sync --frozen --no-cache --no-install-project

COPY ml-service/src /app/src
COPY ml-service/models /app/models

ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"

ENV PYTHONPATH="/app"

EXPOSE 8001 
CMD ["uv", "run", "python", "src/main.py"]