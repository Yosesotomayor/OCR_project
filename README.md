# LeaseLens AI

Plataforma de análisis de contratos y arrendamientos con OCR, embeddings y chat asistido por IA.

## Stack

| Componente | Tecnología |
|------------|------------|
| Frontend | React, Vite, TypeScript, Tailwind |
| Backend | FastAPI, PostgreSQL (pgvector), MinIO |
| ML | Tesseract (OCR), Ollama (LLM), Sentence-Transformers (embeddings), CrossEncoder (reranker) |

## Requisitos

- Docker y Docker Compose
- (Opcional) NVIDIA GPU para Ollama: usar `docker-compose.gpu.yml`

## Inicio rápido

```bash
cp .env.example .env
make run
```

| Servicio | URL |
|----------|-----|
| App | http://localhost |
| Backend API | http://localhost:8000 |
| ML API | http://localhost:8001 |
| MinIO Console | http://localhost:9001 |

## Funcionalidades

- **Documentos**: subida de PDFs, OCR con Tesseract, extracción y vectorización
- **Chat**: conversación con documentos usando RAG (retrieval + LLM)
- **Dashboard**: métricas y resumen
- **Admin**: panel de administración (usuarios admin)

## Variables clave (.env)

| Variable | Descripción |
|----------|-------------|
| `OLLAMA_MODEL` | Modelo LLM (default: `qwen2.5:7b`) |
| `EMBEDDING_MODEL` | Modelo de embeddings |
| `TESSERACT_LANG` | Idioma OCR (default: `spa`) |
| `RERANKER_ENABLED` | Activar reranker para mejorar relevancia |
| `VITE_API_URL` | URL del backend para el frontend |

## Desarrollo local

```bash
# Backend
cd backend && uv run uvicorn app.main:app --reload

# Frontend
cd frontend && npm run dev

# ML (requiere Ollama corriendo)
cd ml && uv run uvicorn app.main:app --reload --port 8001
```