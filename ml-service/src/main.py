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
llm_ready = True

@app.on_event("startup")
async def warmup_llm():
    try:
        logger.info("🔥 Pre-calentando LLM en VRAM...")
        # Una consulta simple para despertar al modelo
        llm.invoke("Responde 'ready'")
        logger.info("✅ LLM listo y caliente.")
    except Exception as e:
        logger.error(f"❌ Error en warmup: {e}")

INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY", "super-secret-key-123")
print(f"ML_SERVICE_INTERNAL_TOKEN loaded: {'*' * len(INTERNAL_TOKEN) if INTERNAL_TOKEN else 'None'}") # Added print statement
BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")

splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

class IngestRequest(BaseModel):
    contract_id: str
    s3_key: str
    filename: str

class ChatRequest(BaseModel):
    question: str
    history: Optional[List[dict]] = []
    portfolio_summary: Optional[str] = None

@app.get("/health")
async def health_check():
    if llm_ready:
        return {"status": "ok", "llm_ready": True}
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="ML service not ready: LLM not loaded.")

async def run_heavy_processing(contract_id: str, s3_key: str, filename: str):
    logger.info(f"Starting heavy processing for contract_id: {contract_id}, s3_key: {s3_key}, filename: {filename}")
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            logger.info(f"Checking contract existence in backend for {contract_id}")
            check = await client.get(
                f"{BACKEND_URL}/contracts/{contract_id}/exists",
                headers={"X-Internal-Token": INTERNAL_TOKEN}
            )
            if check.status_code != 200:
                logger.error(f"Abortando: {contract_id} no existe en Postgres. Status: {check.status_code}")
                # Update contract status to error in backend
                await client.patch(
                    f"{BACKEND_URL}/contracts/{contract_id}",
                    json={"status": "error", "error_detail": f"Contract not found in backend (status {check.status_code})"},
                    headers={"X-Internal-Token": INTERNAL_TOKEN}
                )
                return

            logger.info(f"Downloading file {s3_key} from S3 for {contract_id}")
            file_bytes = s3.download_file(s3_key)
            if not file_bytes:
                logger.error(f"Failed to download file {s3_key} for {contract_id} from S3.")
                await client.patch(
                    f"{BACKEND_URL}/contracts/{contract_id}",
                    json={"status": "error", "error_detail": "Failed to download file from S3"},
                    headers={"X-Internal-Token": INTERNAL_TOKEN}
                )
                return

            logger.info(f"Extracting text from PDF for {contract_id}")
            text = extract_text_from_pdf(file_bytes)
            if text.startswith("ERROR:"):
                logger.error(f"Error extracting text from PDF for {contract_id}: {text}")
                await client.patch(
                    f"{BACKEND_URL}/contracts/{contract_id}",
                    json={"status": "error", "error_detail": text},
                    headers={"X-Internal-Token": INTERNAL_TOKEN}
                )
                return
            
            logger.info(f"Text extracted for {contract_id}. Length: {len(text)}. Chunking...")
            chunks = splitter.split_text(text)
            logger.info(f"Chunks created for {contract_id}. Count: {len(chunks)}. Adding to vector DB...")
            metadatas = [{"doc_id": contract_id, "filename": filename} for _ in chunks]
            ids = [f"{contract_id}_{i}" for i in range(len(chunks))]
            vector_db.add_documents(chunks, metadatas, ids)
            logger.info(f"Documents added to vector DB for {contract_id}.")

            logger.info(f"Invoking LLM for data extraction for {contract_id}")
            prompt = (
                f"Extrae EXACTAMENTE un objeto JSON del siguiente texto de contrato. "
                f"Usa estos campos: 'monto_renta' (número), 'moneda' (ISO), 'arrendatario' (nombre), "
                f"'fecha_vencimiento' (YYYY-MM-DD), 'nombre_propiedad' (string), 'zona_propiedad' (string). "
                f"Si un campo no se encuentra, usa null. No agregues explicaciones ni backticks. Texto: {text[:4000]}"
            )
            raw_extraction = llm.invoke(prompt)
            logger.info(f"LLM extraction completed for {contract_id}. Raw: {raw_extraction[:100]}...")

            await client.patch(
                f"{BACKEND_URL}/contracts/{contract_id}",
                json={"status": "completed", "extracted_data": raw_extraction},
                headers={"X-Internal-Token": INTERNAL_TOKEN}
            )
            logger.info(f"Contrato {contract_id} procesado exitosamente.")

        except Exception as e:
            logger.error(f"Error crítico en procesamiento para {contract_id}: {e}", exc_info=True) # exc_info=True to log traceback
            await client.patch(
                f"{BACKEND_URL}/contracts/{contract_id}",
                json={"status": "error", "error_detail": str(e)},
                headers={"X-Internal-Token": INTERNAL_TOKEN}
            )

@app.post("/query-stream")
async def query_stream(req: ChatRequest):
    # 1. Búsqueda vectorial para detalles profundos (cláusulas)
    results = vector_db.search(req.question, n_results=5)
    context = "\n".join(results['documents'][0])

    formatted_history = ""
    for msg in req.history[-3:]:
        role = "Usuario" if msg['role'] == 'user' else "Asistente"
        formatted_history += f"{role}: {msg['content']}\n"

    # 2. Inyectar Memoria Global + Contexto Vectorial
    full_prompt = (
        f"Eres un analista legal experto de LeaseLens AI.\n"
        f"RESUMEN GLOBAL DEL PORTAFOLIO (Usa esto para estadísticas y listas):\n{req.portfolio_summary}\n\n"
        f"Historial de conversación:\n{formatted_history}\n"
        f"CONTEXTO ESPECÍFICO DE CLÁUSULAS (Usa esto para preguntas sobre el contenido):\n{context}\n\n"
        f"INSTRUCCIÓN: Responde de forma concisa y profesional. Si el usuario pregunta 'cuantos tengo' o sobre montos totales, usa el RESUMEN GLOBAL.\n"
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


