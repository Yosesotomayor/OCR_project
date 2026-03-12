import httpx
import logging
import io
import json
from PIL import Image
from collections.abc import AsyncGenerator

logger = logging.getLogger(__name__)

class LLM:
    def __init__(self, ml_client_async: httpx.AsyncClient):
        self.ml_client_async = ml_client_async

    async def generate(self, prompt: str, temperature: float = 0.7) -> str:
        logger.info(f"Generating for prompt: \n{prompt}")
        response = await self.ml_client_async.post(
            "/llm/generate",
            json={
                "prompt": prompt,
                "temperature": temperature,
            },
        )
        response.raise_for_status()
        return response.json()

    async def generate_stream(self, prompt: str, temperature: float = 0.7) -> AsyncGenerator[str, None]:
        logger.info(f"Generating stream for prompt: \n{prompt}")
        async with self.ml_client_async.stream(
            "POST",
            "/llm/stream",
            json={
                "prompt": prompt,
                "temperature": temperature,
            },
        ) as response:
            async for chunk in response.aiter_text():
                yield chunk


class OCREngine:
    def __init__(self, ml_client_sync: httpx.Client):
        self.ml_client_sync = ml_client_sync

    def extract_text(self, image: Image.Image) -> dict:
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        buffer.seek(0)

        return self.ml_client_sync.post(
            f"/ocr/extract",
            files={"file": ("image.png", buffer, "image/png")},
        ).json()


class EmbeddingModel:
    def __init__(self, ml_client_sync: httpx.Client):
        self.ml_client_sync = ml_client_sync

    def embed_query(self, query: str, **kwargs: dict) -> list[float]:
        return self.ml_client_sync.post(
            "/embeddings/query",
            json={"query": query, "kwargs": kwargs}
        ).json()

    def embed_chunks(self, chunks: list[str], **kwargs: dict) -> list[list[float]]:
        return self.ml_client_sync.post(
            "/embeddings/chunks",
            json={"chunks": chunks, "kwargs": kwargs}
        ).json()
        

class Reranker:
    def __init__(self, ml_client_sync: httpx.Client):
        self.ml_client_sync = ml_client_sync

    def rerank(self, query: str, chunks: list[str]) -> list[int]:
        return self.ml_client_sync.post(
            "/reranker/rerank",
            json={"query": query, "chunks": chunks}
        ).json()