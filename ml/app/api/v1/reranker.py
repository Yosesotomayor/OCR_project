from fastapi import APIRouter, Depends
from app.api.deps import get_reranker
from sentence_transformers import CrossEncoder
from pydantic import BaseModel

router = APIRouter(prefix="/reranker", tags=["reranker"])


class RerankRequest(BaseModel):
    query: str
    chunks: list[str]


@router.post("/rerank", response_model=list[int])
def rerank(
    request: RerankRequest,
    reranker: CrossEncoder = Depends(get_reranker)
):
    pairs = [[request.query, chunk] for chunk in request.chunks]
    scores = reranker.predict(pairs)
    ranked = sorted(
        zip(scores, range(len(request.chunks))), 
        key=lambda x: x[0], 
        reverse=True
    )
    return [index for _, index in ranked]