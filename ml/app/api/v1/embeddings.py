from fastapi import APIRouter, Depends
from app.api.deps import get_embedding_model
from sentence_transformers import SentenceTransformer
from pydantic import BaseModel

router = APIRouter(prefix="/embeddings", tags=["embeddings"])

class EmbedQueryRequest(BaseModel):
    query: str
    kwargs: dict


class EmbedChunksRequest(BaseModel):
    chunks: list[str]
    kwargs: dict


@router.post("/query", response_model=list[float])
def embed_query(
    request: EmbedQueryRequest, 
    embedding_model: SentenceTransformer = Depends(get_embedding_model),
):
    return embedding_model.encode(request.query, **request.kwargs).tolist()


@router.post("/chunks", response_model=list[list[float]])
def embed_chunks(
    request: EmbedChunksRequest, 
    embedding_model: SentenceTransformer = Depends(get_embedding_model),
):
    return embedding_model.encode(request.chunks, **request.kwargs).tolist()