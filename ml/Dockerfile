FROM python:3.11-slim

# Download uv from the Astral Sh project
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# System dependencies:
# - gcc for native Python extensions
# - tesseract-ocr: the binary pytesseract wraps
# - tesseract-ocr-spa: Spanish language data (required by tesseract_lang="spa")
# - poppler-utils + libgl1: common PDF/image processing deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    tesseract-ocr \
    tesseract-ocr-spa \
    poppler-utils \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY . .

RUN uv sync --frozen --no-dev

EXPOSE 8001

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]