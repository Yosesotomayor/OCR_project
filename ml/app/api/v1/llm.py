from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.api.deps import get_ollama_client
from app.infrastructure.llm import OllamaClient
from pydantic import BaseModel

router = APIRouter(prefix="/llm", tags=["llm"])


class GenerateRequest(BaseModel):
    prompt: str
    temperature: float = 0.7


@router.post("/generate")
async def generate(
    request: GenerateRequest, 
    ollama: OllamaClient = Depends(get_ollama_client)
):
    return await ollama.generate(request.prompt, request.temperature)


@router.post("/stream")
async def generate_stream(
    request: GenerateRequest, 
    ollama: OllamaClient = Depends(get_ollama_client)
):
    return StreamingResponse(
        ollama.generate_stream(request.prompt, request.temperature),
        media_type="text/plain"
    )