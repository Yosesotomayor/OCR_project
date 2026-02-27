FROM python:3.11-slim-bookworm
LABEL name="OCR Project - ML Service"

RUN sed -i 's/http:/https:/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    poppler-utils \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN pip install uv

WORKDIR /app

COPY shared /shared

COPY ml-service/pyproject.toml ml-service/uv.lock ./
COPY ml-service/src/download_models.py /app/src/download_models.py

RUN uv run python /app/src/download_models.py


RUN uv sync --frozen --no-cache --no-install-project

COPY ml-service/src /app/src


ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"

ENV PYTHONPATH="/app"

EXPOSE 8001 
CMD ["uv", "run", "python", "src/main.py"]