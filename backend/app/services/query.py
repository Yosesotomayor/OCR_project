import json
import logging
from uuid import UUID
from collections.abc import AsyncGenerator
from app.core.config import settings
from app.models.lease import Chunk
from app.repositories.chunk_repo import ChunkRepo
from app.repositories.lease_repo import LeaseRepo
from app.infrastructure.ml import LLM, EmbeddingModel, Reranker
from app.schemas.query import ChunkSource, QueryIntent, QueryFilters
from app.prompts.query import INTENT_PROMPT, RAG_PROMPT

from app.utils.utils import parse_json
from app.repositories.chat_repo import MessageRepo
from app.models.chat import Role

logger = logging.getLogger(__name__)

class QueryService:
    def __init__(
        self,
        chunk_repo: ChunkRepo,
        lease_repo: LeaseRepo,
        message_repo: MessageRepo,
        llm: LLM,
        embedding_model: EmbeddingModel,
        reranker: Reranker | None,
    ) -> None:
        self.chunk_repo = chunk_repo
        self.lease_repo = lease_repo
        self.message_repo = message_repo
        self.llm = llm
        self._embedding_model = embedding_model
        self._reranker = reranker

    def _embed_query(self, query: str) -> list[float]:
        return self._embedding_model.embed_query(
            query,
            normalize_embeddings=True,
        )

    async def _extract_intent(self, query: str) -> QueryIntent:
        prompt = INTENT_PROMPT.format(query=query)
        response = await self.llm.generate(prompt, temperature=0.0)
        try:
            data = parse_json(response)
            return QueryIntent(**data)
        except Exception as e:
            logger.error(f"Error extracting intent: {e}. Raw response: {response}")
        
        # Fallback to default intent
        return QueryIntent(
            filters=QueryFilters(),
            search_query=query
        )

    def _rerank(self, query: str, chunks: list[Chunk]) -> list[Chunk]:
        if not self._reranker or not chunks:
            return chunks
        chunk_texts = [chunk.text for chunk in chunks]
        indices = self._reranker.rerank(query, chunk_texts)
        return [chunks[i] for i in indices[: settings.reranker_top_n]]

    async def _build_sources(self, chunks: list[Chunk]) -> list[ChunkSource]:
        sources = []
        for chunk in chunks:
            lease = await self.lease_repo.get(chunk.lease_id)
            if lease:
                sources.append(
                    ChunkSource(
                        chunk_id=str(chunk.id),
                        lease_id=str(lease.id),
                        lease_filename=lease.filename,
                        sucursal=lease.sucursal,
                        text=chunk.text,
                    )
                )
        return sources

    async def stream_answer(
        self, 
        query: str,
        lease_filenames: list[str] | None = None,
        chat_id: UUID | None = None
    ) -> AsyncGenerator[str, None]:
        # Step 0: Fetch History and Save User Message
        history_text = ""
        if chat_id:
            history_messages = await self.message_repo.get_by_chat(chat_id, limit=10)
            history_text = str()
            
            for m in history_messages:
                if bool(m.metadata_):
                    sources = m.metadata_.get("sources", [])
                    history_text += "\n\n---\n\n".join(
                        f"[{s['lease_filename']}]\n{s['text']}"
                        for s in sources
                    )

                history_text += f"\n\n{m.role.value.capitalize()}: {m.content}\n"
            
            await self.message_repo.create_message(
                chat_id=chat_id,
                role=Role.USER,
                content=query
            )

        # Step 1: Extract Intent
        intent = await self._extract_intent(query)
        logger.info(f"Extracted intent: {intent}")

        # Step 2: Embed semantic query
        query_embedding = self._embed_query(intent.search_query)
        
        # Step 3: Search with filters
        chunks = await self.chunk_repo.search(
            query_embedding, 
            limit=settings.retrieval_top_k,
            filenames=lease_filenames,
            filters=intent.filters
        )
        
        logger.info(f"Found {len(chunks)} chunks")

        # Step 4: Fallback if no results found with filters
        applied_filters = any(v is not None for v in intent.filters.model_dump().values())
        if applied_filters and not chunks:
            logger.warning("No results with filters, falling back to unfiltered search")
            chunks = await self.chunk_repo.search(
                query_embedding,
                limit=settings.retrieval_top_k,
                filenames=lease_filenames,
                filters=None
            )

        chunks = self._rerank(intent.search_query, list(chunks))
        sources = await self._build_sources(chunks)
        logger.info("Reranked chunks")

        sources_payload = [s.model_dump(mode="json") for s in sources]
        yield f"event: sources\ndata: {json.dumps(sources_payload)}\n\n"

        chunks_text = "\n\n---\n\n".join(
            f"[{s.lease_filename} | {s.sucursal or 'N/A'}]\n{s.text}"
            for s in sources
        )
        # Use semantic query or original query for final generation
        prompt = RAG_PROMPT.format(
            chunks=chunks_text, 
            history=history_text,
            query=query
        )

        full_answer = ""
        async for token in self.llm.generate_stream(prompt):
            full_answer += token
            yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"
        
        # Step 5: Save Assistant Message
        if chat_id:
            await self.message_repo.create_message(
                chat_id=chat_id,
                role=Role.ASSISTANT,
                content=full_answer,
                metadata={"sources": sources_payload}
            )

        yield "event: done\ndata: {}\n\n"
        logger.info(f"Query completed")
