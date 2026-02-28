import os
import logging
from fastapi import FastAPI, BackgroundTasks, HTTPException, status # Added HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from .infrastructure.s3_manager import S3Manager
from .infrastructure.vector_manager import VectorManager
from .parsers.pdf_parser import extract_text_from_pdf

from langchain_ollama import OllamaLLM
from langchain_text_splitters import RecursiveCharacterTextSplitter
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LeaseLens ML-Service")


s3 = S3Manager()
vector_db = VectorManager()

# Add a flag to indicate LLM readiness (simple approach for now)
llm_ready = False

llm = OllamaLLM(
    model="llama3.1:8b", 
    base_url="http://ollama:11434",
    num_ctx=2048,
    stop=["<|eot_id|>"]
)
# After LLM initialization, set the flag
llm_ready = True

INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY", "super-secret-key-123")
BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")

splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

class IngestRequest(BaseModel):
    contract_id: str
    s3_key: str
    filename: str

class ChatRequest(BaseModel):
    question: str
    history: Optional[List[dict]] = []

@app.get("/health")
async def health_check():
    if llm_ready:
        return {"status": "ok", "llm_ready": True}
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="ML service not ready: LLM not loaded.")

async def run_heavy_processing(contract_id: str, s3_key: str, filename: str):

    async with httpx.AsyncClient(timeout=300.0) as client: # Increased timeout
        try:

            check = await client.get(f"{BACKEND_URL}/contracts/{contract_id}/exists")
            if check.status_code != 200:
                logger.error(f"Abortando: {contract_id} no existe en Postgres.")
                return

            file_bytes = s3.download_file(s3_key)
            text = extract_text_from_pdf(file_bytes)
            
            chunks = splitter.split_text(text)
            metadatas = [{"doc_id": contract_id, "filename": filename} for _ in chunks]
            ids = [f"{contract_id}_{i}" for i in range(len(chunks))]
            vector_db.add_documents(chunks, metadatas, ids)

            prompt = (
                f"Extrae EXACTAMENTE un objeto JSON del siguiente texto de contrato. "
                f"Usa estos campos: 'monto_renta' (número), 'moneda' (ISO), 'arrendatario' (nombre). "
                f"No agregues explicaciones ni backticks. Texto: {text[:4000]}"
            )
            raw_extraction = llm.invoke(prompt)

            await client.patch(
                f"{BACKEND_URL}/contracts/{contract_id}",
                json={"status": "completed", "extracted_data": raw_extraction},
                headers={"X-Internal-Token": INTERNAL_TOKEN}
            )
            logger.info(f"Contrato {contract_id} procesado exitosamente.")

        except Exception as e:
            logger.error(f"Error crítico en procesamiento: {e}")
            await client.patch(
                f"{BACKEND_URL}/contracts/{contract_id}",
                json={"status": "error", "error_detail": str(e)},
                headers={"X-Internal-Token": INTERNAL_TOKEN}
            )

@app.post("/query-stream")
async def query_stream(req: ChatRequest):
    results = vector_db.search(req.question, n_results=5)
    context = "\n".join(results['documents'][0])

    formatted_history = ""
    for msg in req.history[-3:]:
        role = "Usuario" if msg['role'] == 'user' else "Asistente"
        formatted_history += f"{role}: {msg['content']}\n"

    full_prompt = (
        f"Eres un analista legal experto de LeaseLens AI.\n"
        f"Historial de conversación:\n{formatted_history}\n"
        f"Contexto del contrato:\n{context}\n\n"
        f"Pregunta del usuario: {req.question}"
    )

    async def generate():
        async for chunk in llm.astream(full_prompt):
            yield chunk

    return StreamingResponse(generate(), media_type="text/plain")

@app.post("/process")
async def process(req: IngestRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_heavy_processing, req.contract_id, req.s3_key, req.filename)
    return {"message": "Queued"}

@app.delete("/delete-vectors/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vectors_from_ml(contract_id: str):
    try:
        vector_db.delete_documents(contract_id)
        logger.info(f"Vectors for contract {contract_id} deleted from vector DB.")
        return
    except Exception as e:
        logger.error(f"Error deleting vectors for contract {contract_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


