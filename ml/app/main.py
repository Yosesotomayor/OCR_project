from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request, Depends, APIRouter
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer, CrossEncoder
from paddleocr import PaddleOCR
from app.core.config import settings
from app.infrastructure.llm import OllamaClient
from app.api.deps import validate_auth
from app.api.v1 import llm, ocr, reranker, embeddings

load_dotenv(override=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ollama = OllamaClient()
    await app.state.ollama.pull_model()

    logger.info("Warming up models...")
    app.state.embedding_model = SentenceTransformer(settings.embedding_model)

    app.state.reranker = None
    if settings.reranker_enabled:
        app.state.reranker = CrossEncoder(settings.reranker_model)

    app.state.paddle_ocr = PaddleOCR(
        lang="es",
        use_angle_cls=True,
    )
    logger.info("Startup complete")

    yield

    logger.info("Shutting down...")
    await app.state.ollama.close()


app = FastAPI(
    title="LeaseLens AI - ML API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public router (no auth)
public_router = APIRouter()

@public_router.get("/")
async def root():
    return RedirectResponse(url="/docs")


# Protected router (auth required)
protected_router = APIRouter(dependencies=[Depends(validate_auth)])

protected_router.include_router(llm.router)
protected_router.include_router(ocr.router)
protected_router.include_router(reranker.router)
protected_router.include_router(embeddings.router)

app.include_router(public_router)
app.include_router(protected_router)


@protected_router.get("/health")
async def health_check():
    return {"status": "ok"}

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception occurred")
    return JSONResponse(
        status_code=500,
        content={"message": str(exc)},
    )