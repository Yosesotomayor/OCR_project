from fastapi import Request, FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sentence_transformers import SentenceTransformer, CrossEncoder
from app.infrastructure.llm import OllamaClient
from app.infrastructure.ocr import OCREngine
from app.core.config import settings

def get_ollama_client(request: Request) -> OllamaClient:
    return request.app.state.ollama

def get_embedding_model(request: Request) -> SentenceTransformer:
    return request.app.state.embedding_model

def get_reranker(request: Request) -> CrossEncoder | None:
    return request.app.state.reranker

def get_ocr_engine(request: Request) -> OCREngine:
    return OCREngine(request.app.state.paddle_ocr)

# Authentication

security = HTTPBearer()

def validate_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    if token != settings.ml_api_key:
        raise HTTPException(
            status_code=401, 
            detail="Invalid ML API Key"
        )