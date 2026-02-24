FROM python:3.11-slim-bookworm
LABEL name="OCR Project - Frontend"

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache --no-install-project

COPY frontend ./frontend
RUN uv sync --frozen --no-cache

EXPOSE 8501

ENV PATH="/app/.venv/bin:$PATH"

ENTRYPOINT ["uv", "run", "python", "-m", "streamlit", "run", "main.py", "--server.port=8501", "--server.address=0.0.0.0"]