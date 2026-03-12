from contextlib import asynccontextmanager
import logging
import httpx
from fastapi import FastAPI, Request
from fastapi.routing import APIRoute
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from dotenv import load_dotenv
from minio import Minio

from app.core.config import settings
from app.infrastructure.db import engine
from app.models.base import Base
from app.api.v1 import leases, auth, users, chat, dashboard

load_dotenv(override=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        await conn.run_sync(Base.metadata.create_all)

    # Initialize long-lived clients
    app.state.minio = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )
    
    app.state.ml_client_async = httpx.AsyncClient(
        base_url=settings.ml_base_url,
        timeout=None,
        headers={"Authorization": f"Bearer {settings.ml_api_key}"},
    )

    app.state.ml_client_sync = httpx.Client(
        base_url=settings.ml_base_url,
        timeout=None,
        headers={"Authorization": f"Bearer {settings.ml_api_key}"},
    )

    logger.info("Startup complete")

    yield

    # Shutdown
    logger.info("Shutting down...")
    await app.state.ml_client_async.aclose()
    app.state.ml_client_sync.close()
    await engine.dispose()


app = FastAPI(
    title="LeaseLens AI - Backend API",
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

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception occurred")
    return JSONResponse(
        status_code=500,
        content={"message": str(exc)},
    )

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(leases.router)
app.include_router(chat.router)
app.include_router(dashboard.router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/")
async def root():
    return RedirectResponse(url="/docs")

for route in app.routes:
    if isinstance(route, APIRoute):
        route.operation_id = route.name