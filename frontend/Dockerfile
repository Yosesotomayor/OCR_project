FROM python:3.11-slim-bookworm
LABEL name="OCR Project - Frontend"

RUN pip install uv

WORKDIR /app

COPY frontend/pyproject.toml frontend/uv.lock ./
RUN uv sync --frozen --no-cache --no-install-project

COPY frontend .
RUN uv sync --frozen --no-cache

EXPOSE 8501

ENV PATH="/app/.venv/bin:$PATH"


ENTRYPOINT ["uv", "run", "python", "-m", "streamlit", "run", "src/app.py", "--server.port=8501", "--server.address=0.0.0.0"]