import httpx
from typing import AsyncGenerator
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi import HTTPException, status
from jose import jwt, JWTError
from minio import Minio
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.user import User, UserRole, UserStatus
from app.schemas.token import TokenPayload
from app.core.config import settings

from app.infrastructure.db import AsyncSessionLocal
from app.infrastructure.ml import LLM, OCREngine, EmbeddingModel, Reranker
from app.infrastructure.storage import StorageClient
from app.repositories.lease_repo import LeaseRepo
from app.repositories.chunk_repo import ChunkRepo
from app.repositories.user_repo import UserRepo
from app.repositories.chat_repo import ChatRepo, MessageRepo
from app.services.auth import AuthService
from app.services.ocr import OCRService
from app.services.ingestion import IngestionService
from app.services.query import QueryService
from app.services.extraction import ExtractionService
from app.services.embedding import EmbeddingService
from app.services.chat import ChatService
from app.services.dashboard import DashboardService

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

# === Auth ===

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_user_repo(db: AsyncSession = Depends(get_db)) -> UserRepo:
    return UserRepo(db)

def get_auth_service(user_repo: UserRepo = Depends(get_user_repo)) -> AuthService:
    return AuthService(user_repo)

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    user_repo: UserRepo = Depends(get_user_repo),
) -> User:
    try:
        payload = jwt.decode(
            token, 
            settings.secret_key, 
            algorithms=[settings.algorithm]
        )

        token_data = TokenPayload(**payload)

    except (JWTError, Exception):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )

    user = await user_repo.get(token_data.sub)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.status != UserStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Inactive user or pending approval"
        )
    return current_user

async def get_current_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="The user doesn't have enough privileges"
        )
    return current_user

# === Ingestion ===

def get_minio(request: Request) -> Minio:
    return request.app.state.minio

def get_storage_client(minio: Minio = Depends(get_minio)) -> StorageClient:
    return StorageClient(minio)

def get_ml_client_async(request: Request) -> httpx.AsyncClient:
    return request.app.state.ml_client_async

def get_ml_client_sync(request: Request) -> httpx.Client:
    return request.app.state.ml_client_sync
    
def get_llm(ml_client_async: httpx.AsyncClient = Depends(get_ml_client_async)) -> LLM:
    return LLM(ml_client_async)

def get_embedding_model(ml_client_sync: httpx.Client = Depends(get_ml_client_sync)) -> EmbeddingModel:
    return EmbeddingModel(ml_client_sync)

def get_reranker(ml_client_sync: httpx.Client = Depends(get_ml_client_sync)) -> Reranker:
    return Reranker(ml_client_sync)

def get_ocr_engine(ml_client_sync: httpx.Client = Depends(get_ml_client_sync)) -> OCREngine:
    return OCREngine(ml_client_sync)

def get_lease_repo(db: AsyncSession = Depends(get_db)) -> LeaseRepo:
    return LeaseRepo(db)

def get_chunk_repo(db: AsyncSession = Depends(get_db)) -> ChunkRepo:
    return ChunkRepo(db)

def get_chat_repo(db: AsyncSession = Depends(get_db)) -> ChatRepo:
    return ChatRepo(db)

def get_message_repo(db: AsyncSession = Depends(get_db)) -> MessageRepo:
    return MessageRepo(db)

def get_extraction_service(llm: LLM = Depends(get_llm)) -> ExtractionService:
    return ExtractionService(llm)

def get_ocr_service(ocr_engine: OCREngine = Depends(get_ocr_engine)) -> OCRService:
    return OCRService(ocr_engine)

def get_embedding_service(
    model: EmbeddingModel = Depends(get_embedding_model),
    chunk_repo: ChunkRepo = Depends(get_chunk_repo)
) -> EmbeddingService:
    return EmbeddingService(model, chunk_repo)

def get_chat_service(
    chat_repo: ChatRepo = Depends(get_chat_repo),
    message_repo: MessageRepo = Depends(get_message_repo),
    llm: LLM = Depends(get_llm),
) -> ChatService:
    return ChatService(chat_repo, message_repo, llm)

def get_ingestion_service(
    lease_repo: LeaseRepo = Depends(get_lease_repo),
    storage_client: StorageClient = Depends(get_storage_client),
    ocr_service: OCRService = Depends(get_ocr_service),
    extraction_service: ExtractionService = Depends(get_extraction_service),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
) -> IngestionService:
    return IngestionService(
        lease_repo=lease_repo, 
        storage_client=storage_client, 
        ocr_service=ocr_service, 
        extraction_service=extraction_service, 
        embedding_service=embedding_service,
    )

def get_query_service(
    chunk_repo: ChunkRepo = Depends(get_chunk_repo),
    lease_repo: LeaseRepo = Depends(get_lease_repo),
    message_repo: MessageRepo = Depends(get_message_repo),
    llm: LLM = Depends(get_llm),
    embedding_model: EmbeddingModel = Depends(get_embedding_model),
    reranker: Reranker | None = Depends(get_reranker),
) -> QueryService:
    return QueryService(
        chunk_repo=chunk_repo, 
        lease_repo=lease_repo, 
        message_repo=message_repo,
        llm=llm, 
        embedding_model=embedding_model, 
        reranker=reranker,
    )

def get_dashboard_service(
    lease_repo: LeaseRepo = Depends(get_lease_repo),
) -> DashboardService:
    return DashboardService(lease_repo)
