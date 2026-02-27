FROM python:3.11-slim-bookworm
LABEL name="OCR Project - Backend"


RUN sed -i 's/http:/https:/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq-dev gcc python3-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN pip install uv

WORKDIR /app


COPY backend/pyproject.toml backend/uv.lock ./

RUN uv sync --frozen --no-cache --no-install-project

COPY backend/src /app/src


EXPOSE 8000

CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]