import uuid
from app.repositories.chunk_repo import ChunkRepo
from app.infrastructure.ml import EmbeddingModel
from app.core.config import settings

class EmbeddingService:
    def __init__(self, model: EmbeddingModel, chunk_repo: ChunkRepo) -> None:
        self._model = model
        self.chunk_repo = chunk_repo
        self.size = settings.chunk_size
        self.overlap = settings.chunk_overlap

    def chunk_text(self, text: str) -> list[str]:
        if not text:
            return []
            
        chunks = []
        start = 0
        while start < len(text):
            end = start + self.size
            chunk = text[start:end]
            chunks.append(chunk)
            
            # If we reached the end of the text, break
            if end >= len(text):
                break
                
            start += self.size - self.overlap
            
        return chunks

    def compute_embeddings(self, chunks: list[str]) -> list[list[float]]:
        return self._model.embed_chunks(
            chunks,
            batch_size=32,
            show_progress_bar=False,
            normalize_embeddings=True,
        )

    async def process(
        self,
        text: str,
        lease_id: uuid.UUID,
    ) -> None:
        chunks = self.chunk_text(text)
        embeddings = self.compute_embeddings(chunks)
        
        for chunk_text, embedding in zip(chunks, embeddings):
            await self.chunk_repo.create(
                lease_id=lease_id,
                text=chunk_text,
                embedding=embedding,
            )
